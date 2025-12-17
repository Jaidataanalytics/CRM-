import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Login = () => {
  const { login } = useAuth();

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1599417262825-fc78c4784982?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwzfHxpbmR1c3RyaWFsJTIwZGllc2VsJTIwZ2VuZXJhdG9yfGVufDB8fHxibGFja19hbmRfd2hpdGV8MTc2NTk2MzUxNHww&ixlib=rb-4.1.0&q=85)'
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/70" />
      
      {/* Content */}
      <Card className="w-full max-w-md mx-4 relative z-10 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <img 
              src="https://images.unsplash.com/photo-1628760584600-6c31148991e9?crop=entropy&cs=srgb&fm=jpg&w=64&h=64&fit=crop" 
              alt="Logo"
              className="w-10 h-10 rounded-full object-cover"
            />
          </div>
          <CardTitle className="font-heading text-2xl">LeadForge</CardTitle>
          <CardDescription className="text-base">
            Lead Management Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Sign in to access your dashboard, manage leads, and view analytics.
          </p>
          <Button 
            onClick={login} 
            className="w-full gap-2"
            size="lg"
            data-testid="google-login-btn"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
