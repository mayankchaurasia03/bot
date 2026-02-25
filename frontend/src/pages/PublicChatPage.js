import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Sparkles, 
  Send,
  Loader2,
  Bot,
  User,
  X,
  MessageCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PublicChatPage = () => {
  const { publicId } = useParams();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true';
  const messagesEndRef = useRef(null);
  
  // Get customization params from URL
  const primaryColor = searchParams.get('primaryColor') || '#0d9488';
  const position = searchParams.get('position') || 'bottom-right';
  const bubbleSize = searchParams.get('bubbleSize') || '60';
  const widgetWidth = searchParams.get('width') || '380';
  const widgetHeight = searchParams.get('height') || '550';
  
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isOpen, setIsOpen] = useState(!isEmbed); // Start closed for embed, open for standalone

  useEffect(() => {
    fetchBot();
  }, [publicId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchBot = async () => {
    try {
      const response = await axios.get(`${API}/public/bot/${publicId}`);
      setBot(response.data);
      setMessages([{
        type: 'bot',
        content: response.data.welcome_message,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Failed to load bot:', error);
    } finally {
      setLoading(false);
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
      const response = await axios.post(`${API}/public/chat/${publicId}`, {
        message: userMessage,
        session_id: sessionId
      });
      
      setSessionId(response.data.session_id);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: response.data.response,
        timestamp: new Date()
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setSending(false);
    }
  };

  // Get position styles
  const getPositionStyles = () => {
    switch (position) {
      case 'bottom-left':
        return { bottom: '20px', left: '20px' };
      case 'top-right':
        return { top: '20px', right: '20px' };
      case 'top-left':
        return { top: '20px', left: '20px' };
      default:
        return { bottom: '20px', right: '20px' };
    }
  };

  if (loading) {
    return (
      <div className={`${isEmbed ? 'h-screen' : 'min-h-screen'} bg-background flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className={`${isEmbed ? 'h-screen' : 'min-h-screen'} bg-background flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Bot Not Found</h2>
          <p className="text-muted-foreground">This chatbot doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // Embedded widget mode
  if (isEmbed) {
    const posStyles = getPositionStyles();
    
    return (
      <div style={{ fontFamily: "'Manrope', sans-serif" }}>
        {/* Floating Chat Bubble */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              position: 'fixed',
              ...posStyles,
              width: `${bubbleSize}px`,
              height: `${bubbleSize}px`,
              borderRadius: '50%',
              backgroundColor: primaryColor,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
            }}
            data-testid="chat-bubble"
          >
            <MessageCircle style={{ width: '28px', height: '28px', color: 'white' }} />
          </button>
        )}

        {/* Chat Window */}
        {isOpen && (
          <div
            style={{
              position: 'fixed',
              ...posStyles,
              width: `${widgetWidth}px`,
              height: `${widgetHeight}px`,
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 9999,
              animation: 'slideIn 0.3s ease-out',
            }}
            data-testid="chat-window"
          >
            <style>{`
              @keyframes slideIn {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
            
            {/* Header */}
            <div
              style={{
                padding: '16px',
                backgroundColor: primaryColor,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bot style={{ width: '22px', height: '22px', color: 'white' }} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '16px', margin: 0 }}>{bot.name}</h3>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                data-testid="close-chat"
              >
                <X style={{ width: '20px', height: '20px', color: 'white' }} />
              </button>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                backgroundColor: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {msg.type !== 'user' && (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: `${primaryColor}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Bot style={{ width: '18px', height: '18px', color: primaryColor }} />
                      </div>
                    )}
                    <div
                      style={{
                        maxWidth: '75%',
                        padding: '12px 16px',
                        borderRadius: msg.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        backgroundColor: msg.type === 'user' ? primaryColor : 'white',
                        color: msg.type === 'user' ? 'white' : '#333',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        boxShadow: msg.type === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    >
                      {msg.content}
                    </div>
                    {msg.type === 'user' && (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: '#e5e5e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <User style={{ width: '18px', height: '18px', color: '#666' }} />
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: `${primaryColor}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Bot style={{ width: '18px', height: '18px', color: primaryColor }} />
                    </div>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '16px 16px 16px 4px',
                        backgroundColor: 'white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    >
                      <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite', color: primaryColor }} />
                      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area with Branding */}
            <div style={{ backgroundColor: 'white', borderTop: '1px solid #eee' }}>
              <div style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = primaryColor}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  data-testid="embed-chat-input"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || sending}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: !message.trim() || sending ? '#ccc' : primaryColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: !message.trim() || sending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s',
                  }}
                  data-testid="embed-send-btn"
                >
                  {sending ? (
                    <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Send style={{ width: '20px', height: '20px' }} />
                  )}
                </button>
              </div>
              {/* Branding - Now below input */}
              <div
                style={{
                  padding: '8px 16px 12px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#999',
                }}
              >
                Powered by <a href="https://ai-chatbot-forge.preview.emergentagent.com" target="_blank" rel="noopener noreferrer" style={{ color: primaryColor, textDecoration: 'none', fontWeight: 500 }}>ContextLink AI</a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standalone page mode (non-embed)
  return (
    <div className="min-h-screen bg-background" data-testid="public-chat-page">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-6 h-20 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">ContextLink AI</span>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-2xl mx-auto">
          {/* Chat Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border bg-card rounded-t-xl">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
              <Bot className="w-5 h-5" style={{ color: primaryColor }} />
            </div>
            <div>
              <h3 className="font-semibold">{bot.name}</h3>
              <p className="text-xs text-muted-foreground">{bot.is_trained ? 'Online' : 'Setting up...'}</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 bg-muted/30">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.type !== 'user' && (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}20` }}>
                      <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.type === 'user'
                        ? 'rounded-br-md text-white'
                        : msg.type === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-card rounded-bl-md shadow-sm'
                    }`}
                    style={msg.type === 'user' ? { backgroundColor: primaryColor } : {}}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
                    <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: primaryColor }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card rounded-b-xl">
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="h-11"
                disabled={sending}
                data-testid="public-chat-input"
              />
              <Button
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                className="h-11 px-4"
                style={{ backgroundColor: primaryColor }}
                data-testid="public-send-btn"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Powered by <a href="/" className="hover:underline" style={{ color: primaryColor }}>ContextLink AI</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicChatPage;
