import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { 
  Sparkles, 
  Moon, 
  Sun, 
  ArrowLeft,
  Plus,
  X,
  Loader2,
  Link2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TrainBotPage = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1); // 1: bot info, 2: urls, 3: training
  const [loading, setLoading] = useState(false);
  const [botId, setBotId] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState(null);
  
  const [botName, setBotName] = useState('');
  const [personality, setPersonality] = useState('You are a helpful AI assistant that answers questions based on the provided context.');
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! How can I help you today?');
  
  const [urls, setUrls] = useState(['']);
  const [urlInput, setUrlInput] = useState('');

  const addUrl = () => {
    if (urlInput.trim() && isValidUrl(urlInput.trim())) {
      setUrls([...urls.filter(u => u), urlInput.trim()]);
      setUrlInput('');
    } else if (urlInput.trim()) {
      toast.error('Please enter a valid URL');
    }
  };

  const removeUrl = (index) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleCreateBot = async () => {
    if (!botName.trim()) {
      toast.error('Please enter a bot name');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/bots`, {
        name: botName,
        personality,
        welcome_message: welcomeMessage
      });
      setBotId(response.data.id);
      toast.success('Bot created! Now add URLs to train it.');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create bot');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTraining = async () => {
    const validUrls = urls.filter(u => u && isValidUrl(u));
    if (validUrls.length === 0) {
      toast.error('Please add at least one valid URL');
      return;
    }

    setLoading(true);
    setStep(3);
    
    try {
      await axios.post(`${API}/training/start`, {
        bot_id: botId,
        urls: validUrls
      });
      
      // Poll for status
      pollTrainingStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start training');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const pollTrainingStatus = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API}/training/status/${botId}`);
        setTrainingStatus(response.data);
        
        if (response.data.status === 'completed') {
          clearInterval(pollInterval);
          toast.success('Training completed!');
        }
      } catch (error) {
        console.error('Status poll error:', error);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="train-bot-page">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight hidden sm:block">ContextLink AI</span>
          </Link>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-md"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-10">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-colors ${
                step >= s 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 rounded-full transition-colors ${
                  step > s ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Bot Info */}
        {step === 1 && (
          <Card className="border-border/50 animate-in">
            <CardHeader>
              <CardTitle className="text-2xl">Create Your Bot</CardTitle>
              <CardDescription>
                Give your bot a name and personality. You can customize this later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bot Name</label>
                <Input
                  placeholder="e.g., Support Assistant"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="h-12"
                  data-testid="bot-name-input"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Personality / System Prompt</label>
                <Textarea
                  placeholder="Describe how your bot should behave..."
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={4}
                  data-testid="personality-input"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Welcome Message</label>
                <Input
                  placeholder="Hello! How can I help you today?"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="h-12"
                  data-testid="welcome-message-input"
                />
              </div>
              
              <Button
                onClick={handleCreateBot}
                className="w-full h-12 btn-primary"
                disabled={loading}
                data-testid="create-bot-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Continue to Training'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: URLs */}
        {step === 2 && (
          <Card className="border-border/50 animate-in">
            <CardHeader>
              <CardTitle className="text-2xl">Train with URLs</CardTitle>
              <CardDescription>
                Add website URLs to train your bot. We'll scrape the content and use it to answer questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="https://example.com/docs"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                    className="pl-10 h-12"
                    data-testid="url-input"
                  />
                </div>
                <Button
                  onClick={addUrl}
                  variant="secondary"
                  className="h-12 px-6"
                  data-testid="add-url-btn"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
              
              {urls.filter(u => u).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {urls.filter(u => u).length} URL(s) added
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {urls.filter(u => u).map((url, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group"
                      >
                        <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1 mono">{url}</span>
                        <button
                          onClick={() => removeUrl(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={handleStartTraining}
                  className="flex-1 h-12 btn-primary"
                  disabled={loading || urls.filter(u => u).length === 0}
                  data-testid="start-training-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Start Training'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Training Progress */}
        {step === 3 && (
          <Card className="border-border/50 animate-in">
            <CardHeader>
              <CardTitle className="text-2xl">Training in Progress</CardTitle>
              <CardDescription>
                Please wait while we scrape and process your URLs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {trainingStatus?.message || 'Initializing...'}
                  </span>
                  <span className="font-medium">
                    {trainingStatus?.progress || 0}%
                  </span>
                </div>
                <Progress value={trainingStatus?.progress || 0} className="h-3" />
                
                {trainingStatus?.status === 'processing' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing {trainingStatus.processed_urls} of {trainingStatus.total_urls} URLs
                  </div>
                )}
              </div>
              
              {trainingStatus?.status === 'completed' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <p className="font-medium">Training Complete!</p>
                      <p className="text-sm opacity-80">{trainingStatus.message}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/dashboard')}
                      className="flex-1 h-12"
                    >
                      Back to Dashboard
                    </Button>
                    <Button
                      onClick={() => navigate(`/playground/${botId}`)}
                      className="flex-1 h-12 btn-primary"
                      data-testid="go-to-playground-btn"
                    >
                      Test Your Bot
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TrainBotPage;
