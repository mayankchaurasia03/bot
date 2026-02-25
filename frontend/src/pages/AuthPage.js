import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';
import { Loader2, Mail, ArrowRight, Sparkles, Link2, MessageSquare, Code2, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [loading, setLoading] = useState(false);
  const { requestOTP, verifyOTP } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const result = await requestOTP(email);
      toast.success(result.message);
      setStep('otp');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete OTP');
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(email, otp);
      toast.success('Welcome to ContextLink AI!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Link2, title: 'Train with URLs', desc: 'Scrape any website to train your bot' },
    { icon: MessageSquare, title: 'Smart Responses', desc: 'AI-powered contextual answers' },
    { icon: Code2, title: 'Easy Embed', desc: 'Add to any website with one snippet' },
  ];

  return (
    <div className="min-h-screen flex" data-testid="auth-page">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary/5 dark:bg-primary/10 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1760443101675-d42daf465e24?crop=entropy&cs=srgb&fm=jpg&q=85)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-primary/20" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-semibold tracking-tight">ContextLink AI</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Build Intelligent<br />
              <span className="text-primary">Context-Aware</span><br />
              Chatbots
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Transform your website content into an AI-powered assistant. Train, customize, and deploy in minutes.
            </p>
          </div>
          
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="flex items-start gap-4 p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50 animate-in stagger-1"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex flex-col p-8 lg:p-16">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-md"
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">ContextLink AI</span>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl tracking-tight">
                {step === 'email' ? 'Welcome back' : 'Check your email'}
              </CardTitle>
              <CardDescription className="text-base">
                {step === 'email' 
                  ? 'Enter your email to sign in or create an account'
                  : `We sent a verification code to ${email}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'email' ? (
                <form onSubmit={handleRequestOTP} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12"
                        data-testid="email-input"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base btn-primary"
                    disabled={loading}
                    data-testid="request-otp-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-sm font-medium">Verification code</label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        data-testid="otp-input"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleVerifyOTP}
                    className="w-full h-12 text-base btn-primary"
                    disabled={loading || otp.length !== 6}
                    data-testid="verify-otp-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Verify & Sign In'
                    )}
                  </Button>
                  
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setOtp(''); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
