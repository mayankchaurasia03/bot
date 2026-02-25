import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { 
  Sparkles, 
  Moon, 
  Sun, 
  ArrowLeft,
  Send,
  Loader2,
  Settings,
  Code2,
  MessageSquare,
  Bot,
  User,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Trash2,
  Plus,
  Palette,
  MessageCircle,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const FRONTEND_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || 'https://ai-chatbot-forge.preview.emergentagent.com';

const PlaygroundPage = () => {
  const { botId } = useParams();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [embedCode, setEmbedCode] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Bot settings
  const [editName, setEditName] = useState('');
  const [editPersonality, setEditPersonality] = useState('');
  const [editWelcome, setEditWelcome] = useState('');
  const [saving, setSaving] = useState(false);
  
  // URLs management
  const [trainedUrls, setTrainedUrls] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState(null);
  const [newUrl, setNewUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  
  // Widget customization
  const [widgetConfig, setWidgetConfig] = useState({
    primaryColor: '#0d9488',
    position: 'bottom-right',
    bubbleSize: 60,
    width: 380,
    height: 550,
  });
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    fetchBot();
    fetchEmbedCode();
    fetchTrainedUrls();
  }, [botId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchBot = async () => {
    try {
      const response = await axios.get(`${API}/bots/${botId}`);
      setBot(response.data);
      setEditName(response.data.name);
      setEditPersonality(response.data.personality);
      setEditWelcome(response.data.welcome_message);
      
      // Add welcome message
      setMessages([{
        type: 'bot',
        content: response.data.welcome_message,
        timestamp: new Date()
      }]);
    } catch (error) {
      toast.error('Failed to load bot');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmbedCode = async () => {
    try {
      const response = await axios.get(`${API}/embed/${botId}`);
      setEmbedCode(response.data);
    } catch (error) {
      console.error('Failed to fetch embed code:', error);
    }
  };

  const fetchTrainedUrls = async () => {
    setLoadingUrls(true);
    try {
      const response = await axios.get(`${API}/training/urls/${botId}`);
      setTrainedUrls(response.data.urls);
    } catch (error) {
      console.error('Failed to fetch URLs:', error);
    } finally {
      setLoadingUrls(false);
    }
  };

  const handleDeleteUrl = async (url) => {
    if (!window.confirm(`Delete all content from "${url}"?`)) return;
    
    setDeletingUrl(url);
    try {
      await axios.delete(`${API}/training/url`, {
        data: { bot_id: botId, source_url: url }
      });
      toast.success('URL content deleted');
      fetchTrainedUrls();
      fetchBot();
    } catch (error) {
      toast.error('Failed to delete URL');
    } finally {
      setDeletingUrl(null);
    }
  };

  const handleAddUrl = async () => {
    if (!newUrl.trim()) return;
    
    try {
      new URL(newUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    
    setAddingUrl(true);
    try {
      await axios.post(`${API}/training/add-urls`, {
        bot_id: botId,
        urls: [newUrl.trim()]
      });
      toast.success('URL added for training');
      setNewUrl('');
      fetchTrainedUrls();
      fetchBot();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add URL');
    } finally {
      setAddingUrl(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;

    const userMessage = message.trim();
    setMessage('');
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setSending(true);
    try {
      const response = await axios.post(`${API}/chat`, {
        bot_id: botId,
        message: userMessage,
        session_id: sessionId
      });
      
      setSessionId(response.data.session_id);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: response.data.response,
        sources: response.data.sources,
        timestamp: new Date()
      }]);
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Failed to get response. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setSending(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/bots/${botId}`, {
        name: editName,
        personality: editPersonality,
        welcome_message: editWelcome
      });
      setBot(prev => ({
        ...prev,
        name: editName,
        personality: editPersonality,
        welcome_message: editWelcome
      }));
      toast.success('Settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const generateEmbedScript = () => {
    if (!bot?.public_id) return '';
    const baseUrl = FRONTEND_URL;
    const params = new URLSearchParams({
      embed: 'true',
      primaryColor: widgetConfig.primaryColor,
      position: widgetConfig.position,
      bubbleSize: widgetConfig.bubbleSize.toString(),
      width: widgetConfig.width.toString(),
      height: widgetConfig.height.toString(),
    });
    
    return `<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${baseUrl}/chat/${bot.public_id}?${params.toString()}';
  iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:100%;height:100%;border:none;z-index:9999;pointer-events:none;';
  iframe.allow = 'microphone';
  var container = document.createElement('div');
  container.id = 'contextlink-chat';
  container.appendChild(iframe);
  document.body.appendChild(container);
  
  window.addEventListener('message', function(e) {
    if (e.data.type === 'contextlink-resize') {
      iframe.style.pointerEvents = e.data.open ? 'auto' : 'none';
    }
  });
})();
</script>`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="playground-page">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight hidden sm:block">ContextLink AI</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium hidden sm:block">{bot?.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-md"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="chat" className="gap-2" data-testid="chat-tab">
              <MessageSquare className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="urls" className="gap-2" data-testid="urls-tab">
              <Link2 className="w-4 h-4" />
              URLs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="settings-tab">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="embed" className="gap-2" data-testid="embed-tab">
              <Code2 className="w-4 h-4" />
              Embed
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-0">
            <Card className="border-border/50 h-[calc(100vh-280px)] min-h-[500px] flex flex-col">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{bot?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {bot?.is_trained ? `${bot.document_count} documents` : 'Not trained'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 animate-in ${
                        msg.type === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {msg.type !== 'user' && (
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.type === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : msg.type === 'error'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                            {msg.sources.slice(0, 2).map((source, i) => (
                              <a
                                key={i}
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline block truncate"
                              >
                                {source}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.type === 'user' && (
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {sending && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    className="h-12"
                    disabled={sending}
                    data-testid="chat-input"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!message.trim() || sending}
                    className="h-12 px-6 btn-primary"
                    data-testid="send-message-btn"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* URLs Tab */}
          <TabsContent value="urls" className="mt-0">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-xl">Trained URLs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New URL */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="https://example.com/page"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                      className="pl-10 h-12"
                      data-testid="add-url-input"
                    />
                  </div>
                  <Button
                    onClick={handleAddUrl}
                    disabled={addingUrl || !newUrl.trim()}
                    className="h-12 px-6 btn-primary"
                    data-testid="add-url-btn"
                  >
                    {addingUrl ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </Button>
                </div>

                {/* URLs List */}
                {loadingUrls ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : trainedUrls.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No URLs trained yet</p>
                    <p className="text-sm">Add URLs above to train your bot</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-4">
                      {trainedUrls.length} URL(s) trained
                    </p>
                    {trainedUrls.map((urlData, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 group"
                      >
                        <Link2 className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{urlData.url}</p>
                          <p className="text-xs text-muted-foreground">
                            {urlData.chunk_count} chunks • Added {new Date(urlData.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUrl(urlData.url)}
                          disabled={deletingUrl === urlData.url}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`delete-url-${index}`}
                        >
                          {deletingUrl === urlData.url ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-0">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-xl">Bot Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bot Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-12"
                    data-testid="edit-name-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Personality / System Prompt</label>
                  <Textarea
                    value={editPersonality}
                    onChange={(e) => setEditPersonality(e.target.value)}
                    rows={4}
                    data-testid="edit-personality-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Welcome Message</label>
                  <Input
                    value={editWelcome}
                    onChange={(e) => setEditWelcome(e.target.value)}
                    className="h-12"
                    data-testid="edit-welcome-input"
                  />
                </div>
                
                <Button
                  onClick={saveSettings}
                  disabled={saving}
                  className="btn-primary"
                  data-testid="save-settings-btn"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Embed Tab */}
          <TabsContent value="embed" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: Customization & Code */}
              <div className="space-y-6">
                {/* Customization Card */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      Widget Customization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Primary Color */}
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-3">
                        <input
                          type="color"
                          value={widgetConfig.primaryColor}
                          onChange={(e) => setWidgetConfig({...widgetConfig, primaryColor: e.target.value})}
                          className="w-12 h-12 rounded-lg cursor-pointer border-0"
                          data-testid="color-picker"
                        />
                        <Input
                          value={widgetConfig.primaryColor}
                          onChange={(e) => setWidgetConfig({...widgetConfig, primaryColor: e.target.value})}
                          className="h-12 mono uppercase"
                          data-testid="color-input"
                        />
                      </div>
                      <div className="flex gap-2 mt-2">
                        {['#0d9488', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e'].map(color => (
                          <button
                            key={color}
                            onClick={() => setWidgetConfig({...widgetConfig, primaryColor: color})}
                            className="w-8 h-8 rounded-full border-2 border-transparent hover:border-foreground/20 transition-colors"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Position */}
                    <div className="space-y-2">
                      <Label>Widget Position</Label>
                      <Select
                        value={widgetConfig.position}
                        onValueChange={(value) => setWidgetConfig({...widgetConfig, position: value})}
                      >
                        <SelectTrigger className="h-12" data-testid="position-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                          <SelectItem value="top-right">Top Right</SelectItem>
                          <SelectItem value="top-left">Top Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bubble Size */}
                    <div className="space-y-2">
                      <Label>Bubble Size: {widgetConfig.bubbleSize}px</Label>
                      <Slider
                        value={[widgetConfig.bubbleSize]}
                        onValueChange={([value]) => setWidgetConfig({...widgetConfig, bubbleSize: value})}
                        min={40}
                        max={80}
                        step={5}
                        className="py-2"
                        data-testid="bubble-size-slider"
                      />
                    </div>

                    {/* Widget Size */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Width: {widgetConfig.width}px</Label>
                        <Slider
                          value={[widgetConfig.width]}
                          onValueChange={([value]) => setWidgetConfig({...widgetConfig, width: value})}
                          min={320}
                          max={450}
                          step={10}
                          className="py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Height: {widgetConfig.height}px</Label>
                        <Slider
                          value={[widgetConfig.height]}
                          onValueChange={([value]) => setWidgetConfig({...widgetConfig, height: value})}
                          min={400}
                          max={650}
                          step={10}
                          className="py-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Public URL Card */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Public URL</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={embedCode?.public_url || ''}
                        readOnly
                        className="h-11 mono text-sm"
                        data-testid="public-url-input"
                      />
                      <Button
                        variant="secondary"
                        onClick={() => copyToClipboard(embedCode?.public_url)}
                        className="h-11 px-4"
                        data-testid="copy-url-btn"
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Embed Script Card */}
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Embed Script</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Add this script to your website to embed the chat widget.
                    </p>
                    <div className="relative">
                      <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto mono max-h-48">
                        <code>{generateEmbedScript()}</code>
                      </pre>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(generateEmbedScript())}
                        className="absolute top-2 right-2"
                        data-testid="copy-embed-btn"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live Preview */}
              <Card className="border-border/50 h-fit sticky top-24">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl overflow-hidden"
                    style={{ height: '500px' }}
                  >
                    {/* Preview Website Mockup */}
                    <div className="absolute inset-4 bg-white dark:bg-slate-950 rounded-lg shadow-lg overflow-hidden">
                      <div className="h-8 bg-muted flex items-center px-3 gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                        <div className="flex-1 mx-4">
                          <div className="h-4 bg-muted-foreground/10 rounded-full" />
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                        <div className="h-20 bg-muted rounded mt-4" />
                        <div className="h-4 bg-muted rounded w-2/3" />
                        <div className="h-4 bg-muted rounded w-1/3" />
                      </div>
                    </div>

                    {/* Chat Widget Preview */}
                    <div
                      className="absolute transition-all duration-300"
                      style={{
                        ...(widgetConfig.position === 'bottom-right' && { bottom: '20px', right: '20px' }),
                        ...(widgetConfig.position === 'bottom-left' && { bottom: '20px', left: '20px' }),
                        ...(widgetConfig.position === 'top-right' && { top: '50px', right: '20px' }),
                        ...(widgetConfig.position === 'top-left' && { top: '50px', left: '20px' }),
                      }}
                    >
                      {!previewOpen ? (
                        <button
                          onClick={() => setPreviewOpen(true)}
                          className="rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                          style={{
                            width: `${Math.min(widgetConfig.bubbleSize, 50)}px`,
                            height: `${Math.min(widgetConfig.bubbleSize, 50)}px`,
                            backgroundColor: widgetConfig.primaryColor,
                          }}
                        >
                          <MessageCircle className="w-6 h-6 text-white" />
                        </button>
                      ) : (
                        <div
                          className="bg-white dark:bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                          style={{
                            width: `${Math.min(widgetConfig.width, 280)}px`,
                            height: `${Math.min(widgetConfig.height, 380)}px`,
                          }}
                        >
                          {/* Widget Header */}
                          <div
                            className="p-3 flex items-center justify-between"
                            style={{ backgroundColor: widgetConfig.primaryColor }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                              </div>
                              <span className="text-white font-medium text-sm">{bot?.name || 'Chat Bot'}</span>
                            </div>
                            <button
                              onClick={() => setPreviewOpen(false)}
                              className="p-1.5 rounded-md bg-white/20 hover:bg-white/30"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                          {/* Widget Messages */}
                          <div className="flex-1 p-3 bg-slate-50 dark:bg-muted/30 overflow-hidden">
                            <div className="flex gap-2">
                              <div 
                                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${widgetConfig.primaryColor}20` }}
                              >
                                <Bot className="w-3 h-3" style={{ color: widgetConfig.primaryColor }} />
                              </div>
                              <div className="bg-white dark:bg-card p-2 rounded-xl rounded-bl-sm text-xs shadow-sm max-w-[80%]">
                                {bot?.welcome_message || 'Hello! How can I help?'}
                              </div>
                            </div>
                          </div>
                          {/* Widget Input */}
                          <div className="p-2 bg-white dark:bg-card border-t border-border">
                            <div className="flex gap-2">
                              <div className="flex-1 h-8 bg-muted rounded-lg" />
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: widgetConfig.primaryColor }}
                              >
                                <Send className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <p className="text-center text-[9px] text-muted-foreground mt-1.5">
                              Powered by ContextLink AI
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Click the widget to toggle preview
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PlaygroundPage;
