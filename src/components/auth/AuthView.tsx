
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Heart, Sparkles, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { validatePasswordStrength, getPasswordRequirements, type PasswordStrength } from "@/lib/password-validation";
import { cn } from "@/lib/utils";

export const AuthView = () => {
  const { signIn, signUp, resetPassword, resendVerificationEmail, user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    name?: string;
    resetEmail?: string;
  }>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const newErrors: typeof formErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signIn(email, password, rememberMe);
      // Check email verification status after successful login
      await refreshUser();
      
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your secure capsule vault.",
      });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Sign in failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors: typeof formErrors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    
    // Validate password strength before submission
    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      setShowPasswordRequirements(true);
      toast({
        title: "Password too weak",
        description: "Please create a stronger password that meets all requirements.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signUp(email, password, name);
      setShowVerificationPrompt(true);
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Account creation failed",
        description: "Please try again with different details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
    
    // Validate password strength on change
    const validation = validatePasswordStrength(newPassword);
    setPasswordStrength(validation.strength);
    setPasswordErrors(validation.errors);
    
    // Show requirements when user starts typing
    if (newPassword.length > 0) {
      setShowPasswordRequirements(true);
    } else {
      setShowPasswordRequirements(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    
    try {
      await resendVerificationEmail();
      toast({
        title: "Verification email sent",
        description: "Please check your email inbox and spam folder.",
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Failed to send verification email",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsLoading(true);
    
    try {
      await refreshUser();
      
      if (user?.emailVerified) {
        toast({
          title: "Email verified!",
          description: "You can now access all features.",
        });
        setShowVerificationPrompt(false);
      } else {
        toast({
          title: "Email not verified yet",
          description: "Please check your email and click the verification link.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Check verification error:", error);
      toast({
        title: "Failed to check verification status",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate reset email
    const newErrors: typeof formErrors = {};
    if (!resetEmail.trim()) {
      newErrors.resetEmail = 'Email is required';
    } else if (!validateEmail(resetEmail)) {
      newErrors.resetEmail = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    
    setIsLoading(true);
    
    try {
      await resetPassword(resetEmail);
      toast({
        title: "Password reset email sent",
        description: "Check your email for instructions to reset your password.",
      });
      setShowPasswordReset(false);
      setResetEmail("");
      setFormErrors({});
    } catch (error) {
      console.error("Password reset error:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Password reset failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show verification prompt if user is logged in but email not verified
  if (showVerificationPrompt || (user && !user.emailVerified)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-amber-600">
              <Clock className="h-8 w-8" />
              <Sparkles className="h-6 w-6" />
              <Heart className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
              Verify Your Email
            </h1>
          </div>

          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center text-gray-800">Check Your Inbox</CardTitle>
              <CardDescription className="text-center text-gray-600">
                We've sent a verification link to <strong>{user?.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-gray-700">
                <p className="mb-2">Please verify your email to access all features:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the verification link in the email</li>
                  <li>Return here and click "I've Verified My Email"</li>
                </ol>
              </div>

              <Button
                onClick={handleCheckVerification}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Checking..." : "I've Verified My Email"}
              </Button>

              <Button
                onClick={handleResendVerification}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Resend Verification Email"}
              </Button>

              <div className="text-center text-sm text-gray-500">
                Didn't receive the email? Check your spam folder or click resend.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-amber-600">
            <Clock className="h-8 w-8" />
            <Sparkles className="h-6 w-6" />
            <Heart className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Digital Time Capsule
          </h1>
          <p className="text-gray-600 leading-relaxed">
            Store memories, thoughts, and dreams for your future self. 
            Let AI help you rediscover patterns in your journey through time.
          </p>
        </div>

        {/* Auth Forms */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          {showPasswordReset ? (
            // Password Reset Form
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl text-center text-gray-800">Reset Password</CardTitle>
                <CardDescription className="text-center text-gray-600">
                  Enter your email to receive reset instructions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (formErrors.resetEmail) {
                          setFormErrors({ ...formErrors, resetEmail: undefined });
                        }
                      }}
                      required
                      className={`border-gray-200 focus:border-amber-400 focus:ring-amber-400 ${formErrors.resetEmail ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    {formErrors.resetEmail && (
                      <p className="text-sm text-red-500">{formErrors.resetEmail}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Email"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowPasswordReset(false);
                      setResetEmail("");
                    }}
                    disabled={isLoading}
                  >
                    Back to Sign In
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            // Login/Signup Tabs
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="text-sm">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="text-sm">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-xl text-center text-gray-800">Welcome back</CardTitle>
                  <CardDescription className="text-center text-gray-600">
                    Continue your journey through time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (formErrors.email) {
                            setFormErrors({ ...formErrors, email: undefined });
                          }
                        }}
                        required
                        className={`border-gray-200 focus:border-amber-400 focus:ring-amber-400 ${formErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {formErrors.email && (
                        <p className="text-sm text-red-500">{formErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="border-gray-200 focus:border-amber-400 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                      />
                      <label
                        htmlFor="remember-me"
                        className="text-sm text-gray-700 cursor-pointer select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(true)}
                        className="text-sm text-amber-600 hover:text-amber-700 underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </form>
                </CardContent>
              </TabsContent>

              <TabsContent value="signup">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-xl text-center text-gray-800">Begin your journey</CardTitle>
                  <CardDescription className="text-center text-gray-600">
                    Create your first time capsule today
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (formErrors.name) {
                            setFormErrors({ ...formErrors, name: undefined });
                          }
                        }}
                        required
                        className={`border-gray-200 focus:border-amber-400 focus:ring-amber-400 ${formErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {formErrors.name && (
                        <p className="text-sm text-red-500">{formErrors.name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (formErrors.email) {
                            setFormErrors({ ...formErrors, email: undefined });
                          }
                        }}
                        required
                        className={`border-gray-200 focus:border-amber-400 focus:ring-amber-400 ${formErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {formErrors.email && (
                        <p className="text-sm text-red-500">{formErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => handlePasswordChange(e.target.value)}
                        required
                        className="border-gray-200 focus:border-amber-400 focus:ring-amber-400"
                      />
                      
                      {/* Password Strength Indicator */}
                      {showPasswordRequirements && password.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Password strength:</span>
                            <div className="flex gap-1 flex-1">
                              <div className={`h-1.5 flex-1 rounded ${passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                              <div className={`h-1.5 flex-1 rounded ${passwordStrength === 'medium' || passwordStrength === 'strong' ? passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500' : 'bg-gray-200'}`} />
                              <div className={`h-1.5 flex-1 rounded ${passwordStrength === 'strong' ? 'bg-green-500' : 'bg-gray-200'}`} />
                            </div>
                            <span className={`text-xs font-medium ${passwordStrength === 'weak' ? 'text-red-600' : passwordStrength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                              {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                            </span>
                          </div>
                          
                          {/* Password Requirements */}
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5">
                            <p className="text-xs font-medium text-gray-700 mb-2">Password must contain:</p>
                            {getPasswordRequirements().map((requirement, index) => {
                              const checks = validatePasswordStrength(password).checks;
                              const checkKeys = ['minLength', 'hasUppercase', 'hasLowercase', 'hasNumber', 'hasSpecialChar'];
                              const isValid = checks[checkKeys[index] as keyof typeof checks];
                              
                              return (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  {isValid ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className={isValid ? 'text-green-700' : 'text-gray-600'}>
                                    {requirement}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </TabsContent>
            </Tabs>
          )}
        </Card>

        <p className="text-center text-sm text-gray-500">
          Your memories are encrypted and private. Only you can access them.
        </p>
      </div>
    </div>
  );
};
