import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Bot, 
  FileText, 
  MessageSquare, 
  Zap,
  Plus,
  ArrowRight,
  Moon,
  Sun,
  LogOut,
  Sparkles,
  TrendingUp,
  Crown,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingBot, setDeletingBot] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, botsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/bots`)
      ]);
      setStats(statsRes.data);
      setBots(botsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (botId, botName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${botName}"? This cannot be undone.`)) {
      return;
    }
    
    setDeletingBot(botId);
    try {
      await axios.delete(`${API}/bots/${botId}`);
      toast.success('Bot deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete bot');
    } finally {
      setDeletingBot(null);
    }
  };

  const handleCreateBot = () => {
    if (!stats?.subscription) {
      toast.error('Please subscribe to a plan to create bots');
      navigate('/pricing');
      return;
    }
    
    if (stats.bots_remaining === 0) {
      toast.error('You have reached your bot limit. Upgrade your plan to create more.');
      navigate('/pricing');
      return;
    }
    
    navigate('/train');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const statCards = [
    { 
      title: 'Total Bots', 
      value: stats?.total_bots || 0, 
      icon: Bot, 
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    { 
      title: 'Active Bots', 
      value: stats?.active_bots || 0, 
      icon: Zap, 
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    { 
      title: 'Documents', 
      value: stats?.total_documents || 0, 
      icon: FileText, 
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      title: 'Total Chats', 
      value: stats?.total_chats || 0, 
      icon: MessageSquare, 
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
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
            
            <div className="h-8 w-px bg-border" />
            
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="rounded-md text-muted-foreground hover:text-destructive"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your AI chatbots and monitor their performance.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {statCards.map((stat, index) => (
            <Card 
              key={stat.title} 
              className="border-border/50 card-hover animate-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Subscription & Token Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {/* Subscription Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  Subscription
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/pricing')}
                  data-testid="manage-subscription-btn"
                >
                  {stats?.subscription ? 'Manage' : 'Subscribe'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.subscription ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-semibold">{stats.subscription.plan_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bots</span>
                    <span className="font-semibold">
                      {stats.total_bots} / {stats.subscription.bots_allowed === -1 ? '∞' : stats.subscription.bots_allowed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="font-semibold text-sm">
                      {new Date(stats.subscription.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No active subscription</p>
                  <Button onClick={() => navigate('/pricing')} className="btn-primary">
                    View Plans
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Usage Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Token Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-4xl font-bold tracking-tight text-primary">
                    {(stats?.total_tokens_used || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">tokens used this month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Bots Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Your Bots</h2>
          <Button 
            onClick={handleCreateBot}
            className="btn-primary"
            data-testid="create-bot-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Bot
          </Button>
        </div>

        {bots.length === 0 ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No bots yet</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                {stats?.subscription 
                  ? 'Create your first AI chatbot by training it with website URLs.'
                  : 'Subscribe to a plan to start creating AI chatbots.'}
              </p>
              <Button 
                onClick={handleCreateBot}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                {stats?.subscription ? 'Create Your First Bot' : 'View Plans'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot, index) => (
              <Card 
                key={bot.id} 
                className="border-border/50 card-hover cursor-pointer group animate-in relative"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => navigate(`/playground/${bot.id}`)}
                data-testid={`bot-card-${bot.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        bot.is_trained 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {bot.is_trained ? 'Active' : 'Not Trained'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteBot(bot.id, bot.name, e)}
                        disabled={deletingBot === bot.id}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        data-testid={`delete-bot-${bot.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {bot.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {bot.personality}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{bot.document_count} documents</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
