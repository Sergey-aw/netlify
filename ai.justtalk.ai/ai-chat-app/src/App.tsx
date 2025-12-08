import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

// Contexts
import { AuthProvider } from './contexts/AuthContext'

// Components
import ProtectedRoute from './components/ProtectedRoute'
import { OnboardingResumeHandler } from './components/OnboardingResumeHandler'

// Pages
import Login from './pages/Login'
import SignIn from './pages/SignIn'
import EmailVerification from './pages/EmailVerification'
import AuthCallback from './pages/AuthCallback'
import SetupPassword from './pages/SetupPassword'
import AIChatHome from './pages/AIChatHome'
import AIChatConversation from './pages/AIChatConversation'
import AIChatVoice from './pages/AIChatVoice'
import RolePlays from './pages/RolePlays'
import VocabularyBuilder from './pages/VocabularyBuilder'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import SubscriptionPlans from './pages/SubscriptionPlans'
import SubscriptionStatus from './pages/SubscriptionStatus'
import SubscriptionManagement from './pages/SubscriptionManagement'
import OnboardingGoals from './pages/onboarding/OnboardingGoals'
import OnboardingInterests from './pages/onboarding/OnboardingInterests'
import OnboardingPreferences from './pages/onboarding/OnboardingPreferences'
import PronunciationAssessment from './pages/onboarding/PronunciationAssessment'
import WelcomeProgress from './pages/onboarding/WelcomeProgress'
import WelcomeFeatures from './pages/onboarding/WelcomeFeatures'
import WelcomeSync from './pages/onboarding/WelcomeSync'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <OnboardingResumeHandler />
          <Routes>
            {/* Public Routes - Welcome Screens First */}
            <Route path="/welcome" element={<WelcomeProgress />} />
            <Route path="/welcome/features" element={<WelcomeFeatures />} />
            <Route path="/welcome/sync" element={<WelcomeSync />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/setup-password" element={<SetupPassword />} />
            
            {/* Onboarding Routes - Can be accessed without full auth */}
            <Route path="/onboarding/pronunciation" element={<PronunciationAssessment />} />
            <Route path="/onboarding/goals" element={<OnboardingGoals />} />
            <Route path="/onboarding/interests" element={<OnboardingInterests />} />
            <Route path="/onboarding/preferences" element={<OnboardingPreferences />} />

            {/* Protected Routes */}
            <Route path="/ai-chat" element={<ProtectedRoute><AIChatHome /></ProtectedRoute>} />
            <Route path="/ai-chat/conversation/:id?" element={<ProtectedRoute><AIChatConversation /></ProtectedRoute>} />
            <Route path="/ai-chat/voice/:id?" element={<ProtectedRoute><AIChatVoice /></ProtectedRoute>} />
            <Route path="/role-plays" element={<ProtectedRoute><RolePlays /></ProtectedRoute>} />
            <Route path="/dictionary" element={<ProtectedRoute><VocabularyBuilder /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/subscription-plans" element={<SubscriptionPlans />} />
            <Route path="/subscription-status" element={<ProtectedRoute><SubscriptionStatus /></ProtectedRoute>} />
            <Route path="/subscription/plans" element={<SubscriptionPlans />} />
            <Route path="/subscription/manage" element={<ProtectedRoute><SubscriptionManagement /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
