import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { 
  Sparkles, 
  Moon, 
  Sun, 
  ArrowLeft,
  Check,
  Loader2,
  Crown,
  Zap,
  Rocket
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID;

const PricingPage = () => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);

  useEffect(() => {
    fetchData();
    loadRazorpayScript();
  }, []);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const fetchData = async () => {
    try {
      // Always fetch plans (public endpoint)
      const plansRes = await axios.get(`${API}/subscription/plans`);
      setPlans(plansRes.data.plans);
      
      // Try to fetch current subscription (requires auth)
      try {
        const subRes = await axios.get(`${API}/subscription/current`);
        setCurrentSubscription(subRes.data);
      } catch (authError) {
        // User not authenticated - this is okay for pricing page
        console.log('User not authenticated, showing public pricing');
        setCurrentSubscription(null);
      }
    } catch (error) {
      console.error('Failed to fetch pricing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    setProcessingPlan(planId);
    
    try {
      // Create order
      const orderRes = await axios.post(`${API}/subscription/create-order`, {
        plan_id: planId
      });
      
      const { order_id, amount, key_id, plan } = orderRes.data;
      
      // Open Razorpay checkout
      const options = {
        key: key_id || RAZORPAY_KEY,
        amount: amount,
        currency: 'INR',
        name: 'ContextLink AI',
        description: `${plan.name} Plan - Monthly Subscription`,
        order_id: order_id,
        handler: async (response) => {
          try {
            // Verify payment
            const verifyRes = await axios.post(`${API}/subscription/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: planId
            });
            
            toast.success(verifyRes.data.message);
            fetchData();
            navigate('/dashboard');
          } catch (error) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          email: currentSubscription?.email || ''
        },
        theme: {
          color: theme === 'dark' ? '#00bcd4' : '#0d9488'
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Please login to subscribe to a plan');
        navigate('/');  // Redirect to login
      } else {
        toast.error(error.response?.data?.detail || 'Failed to create order');
      }
    } finally {
      setProcessingPlan(null);
    }
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'starter': return Zap;
      case 'basic': return Rocket;
      case 'pro': return Crown;
      default: return Zap;
    }
  };

  const getPlanColor = (planId) => {
    switch (planId) {
      case 'starter': return 'text-blue-500 bg-blue-500/10';
      case 'basic': return 'text-purple-500 bg-purple-500/10';
      case 'pro': return 'text-amber-500 bg-amber-500/10';
      default: return 'text-primary bg-primary/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="pricing-page">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-8 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start building intelligent chatbots today. All plans include full access to training, chat, and embed features.
          </p>
        </div>

        {/* Current Subscription Banner */}
        {currentSubscription?.has_subscription && (
          <div className="mb-8 p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-sm">
              You're currently on the <strong>{currentSubscription.plan?.name}</strong> plan.
              {currentSubscription.bots_remaining !== -1 && (
                <span className="ml-2">
                  ({currentSubscription.bots_used}/{currentSubscription.bots_allowed} bots used)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const Icon = getPlanIcon(plan.plan_id);
            const colorClass = getPlanColor(plan.plan_id);
            const isCurrentPlan = currentSubscription?.subscription?.plan_id === plan.plan_id;
            const isPopular = plan.plan_id === 'basic';
            
            return (
              <Card 
                key={plan.plan_id}
                className={`relative border-border/50 transition-all duration-300 hover:shadow-lg ${
                  isPopular ? 'ring-2 ring-primary scale-105 md:scale-110' : ''
                } ${isCurrentPlan ? 'bg-primary/5' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className={`w-14 h-14 rounded-xl ${colorClass} flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price_display}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  
                  <ul className="space-y-3 mb-8 text-left">
                    <li className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span>{plan.bots_allowed === -1 ? 'Unlimited' : plan.bots_allowed} bot{plan.bots_allowed !== 1 ? 's' : ''}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span>Unlimited URL training</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span>Vector similarity search</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span>Embed on any website</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <span>AI-powered responses</span>
                    </li>
                  </ul>
                  
                  <Button
                    onClick={() => handleSubscribe(plan.plan_id)}
                    disabled={isCurrentPlan || processingPlan === plan.plan_id}
                    className={`w-full h-12 ${isPopular ? 'btn-primary' : ''}`}
                    variant={isPopular ? 'default' : 'outline'}
                    data-testid={`subscribe-${plan.plan_id}-btn`}
                  >
                    {processingPlan === plan.plan_id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Features Comparison */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            All plans include: Email OTP auth, Dashboard analytics, ChromaDB vector search, Gemini AI responses
          </p>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
