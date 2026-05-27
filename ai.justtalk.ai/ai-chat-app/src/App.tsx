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
import ForgotPassword from './pages/ForgotPassword'
import EmailVerification from './pages/EmailVerification'
import AuthCallback from './pages/AuthCallback'
import SetupPassword from './pages/SetupPassword'
import AIChatHome from './pages/AIChatHome'
import AIChatConversation from './pages/AIChatConversation'
import AIChatVoice from './pages/AIChatVoice'
import RolePlays from './pages/RolePlays'
import RolePlaysV2 from './pages/RolePlaysV2'
import VocabularyBuilder from './pages/VocabularyBuilder'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import ContactSupport from './pages/ContactSupport'
import SubscriptionPlans from './pages/SubscriptionPlans'
import SubscriptionStatus from './pages/SubscriptionStatus'
import SubscriptionManagement from './pages/SubscriptionManagement'
import CheckoutPage from './pages/CheckoutPage'
import OnboardingAge from './pages/onboarding/OnboardingAge'
import OnboardingNativeLanguage from './pages/onboarding/OnboardingNativeLanguage'
import OnboardingSpeakingConfidence from './pages/onboarding/OnboardingSpeakingConfidence'
import OnboardingCurrentLearning from './pages/onboarding/OnboardingCurrentLearning'
import OnboardingRetentionStats from './pages/onboarding/OnboardingRetentionStats'
import OnboardingDailyUsage from './pages/onboarding/OnboardingDailyUsage'
import OnboardingPainPoints from './pages/onboarding/OnboardingPainPoints'
import OnboardingMotivation from './pages/onboarding/OnboardingMotivation'
import OnboardingMotivationStats from './pages/onboarding/OnboardingMotivationStats'
import OnboardingGoals from './pages/onboarding/OnboardingGoals'
import OnboardingInterests from './pages/onboarding/OnboardingInterests'
import OnboardingPreferences from './pages/onboarding/OnboardingPreferences'
import PronunciationAssessment from './pages/onboarding/PronunciationAssessment'
import VocabCheckIntro from './pages/onboarding/VocabCheckIntro'
import OnboardingName from './pages/onboarding/OnboardingName'
import VocabCheckWords from './pages/onboarding/VocabCheckWords'
import VocabCheckResult from './pages/onboarding/VocabCheckResult'
import WelcomeProgress from './pages/onboarding/WelcomeProgress'
import WelcomeFeatures from './pages/onboarding/WelcomeFeatures'
import WelcomeSync from './pages/onboarding/WelcomeSync'
import PronunciationPractice from './pages/PronunciationPractice'
import IELTS from './pages/IELTS'
import IELTSCategory from './pages/IELTSCategory'
import IELTSTest from './pages/IELTSTest'
import IELTSExaminer from './pages/IELTSExaminer'
import IELTSResults from './pages/IELTSResults'
import IELTSCoach from './pages/IELTSCoach'

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
            {/* Root Route - Handled by OnboardingResumeHandler */}
            <Route path="/" element={<WelcomeProgress />} />
            
            {/* Public Routes - Welcome Screens First */}
            <Route path="/welcome" element={<WelcomeProgress />} />
            <Route path="/welcome/features" element={<WelcomeFeatures />} />
            <Route path="/welcome/sync" element={<WelcomeSync />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/setup-password" element={<SetupPassword />} />
            
            {/* Onboarding Routes - Can be accessed without full auth */}
            <Route path="/onboarding/pronunciation" element={<PronunciationAssessment />} />
            <Route path="/onboarding/age" element={<OnboardingAge />} />
            <Route path="/onboarding/native-language" element={<OnboardingNativeLanguage />} />
            <Route path="/onboarding/speaking-confidence" element={<OnboardingSpeakingConfidence />} />
            <Route path="/onboarding/current-learning" element={<OnboardingCurrentLearning />} />
            <Route path="/onboarding/retention-stats" element={<OnboardingRetentionStats />} />
            <Route path="/onboarding/daily-usage" element={<OnboardingDailyUsage />} />
            <Route path="/onboarding/pain-points" element={<OnboardingPainPoints />} />
            <Route path="/onboarding/motivation" element={<OnboardingMotivation />} />
            <Route path="/onboarding/motivation-stats" element={<OnboardingMotivationStats />} />
            <Route path="/onboarding/vocab-intro" element={<VocabCheckIntro />} />
            <Route path="/onboarding/name" element={<OnboardingName />} />
            <Route path="/onboarding/vocab-check" element={<VocabCheckWords />} />
            <Route path="/onboarding/vocab-result" element={<VocabCheckResult />} />
            <Route path="/onboarding/goals" element={<OnboardingGoals />} />
            <Route path="/onboarding/interests" element={<OnboardingInterests />} />
            <Route path="/onboarding/preferences" element={<OnboardingPreferences />} />

            {/* Protected Routes */}
            <Route path="/ai-chat" element={<ProtectedRoute><AIChatHome /></ProtectedRoute>} />
            <Route path="/ai-chat/conversation/:id?" element={<ProtectedRoute><AIChatConversation /></ProtectedRoute>} />
            <Route path="/ai-chat/voice/:id?" element={<ProtectedRoute><AIChatVoice /></ProtectedRoute>} />
            <Route path="/role-plays" element={<ProtectedRoute><RolePlaysV2 /></ProtectedRoute>} />
            <Route path="/role-plays-v1" element={<ProtectedRoute><RolePlays /></ProtectedRoute>} />
            <Route path="/dictionary" element={<ProtectedRoute><VocabularyBuilder /></ProtectedRoute>} />
            <Route path="/pronunciation-practice" element={<ProtectedRoute><PronunciationPractice /></ProtectedRoute>} />
            <Route path="/ielts" element={<ProtectedRoute><IELTS /></ProtectedRoute>} />
            <Route path="/ielts/category/:slug" element={<ProtectedRoute><IELTSCategory /></ProtectedRoute>} />
            <Route path="/ielts/test/:id" element={<ProtectedRoute><IELTSTest /></ProtectedRoute>} />
            <Route path="/ielts/test/:id/part/:partNum/examiner" element={<ProtectedRoute><IELTSExaminer /></ProtectedRoute>} />
            <Route path="/ielts/attempt/:attemptId/results" element={<ProtectedRoute><IELTSResults /></ProtectedRoute>} />
            <Route path="/ielts/test/:id/part/:partNum/coach" element={<ProtectedRoute><IELTSCoach /></ProtectedRoute>} />
            <Route path="/ielts/test/:id/part/:partNum/coach/retry" element={<ProtectedRoute><IELTSCoach mode="retry" /></ProtectedRoute>} />
            <Route path="/ielts/test/:id/coach/mock" element={<ProtectedRoute><IELTSCoach mode="mock_review" /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/contact-support" element={<ProtectedRoute><ContactSupport /></ProtectedRoute>} />
            <Route path="/subscription-plans" element={<SubscriptionPlans />} />
            <Route path="/subscription-status" element={<ProtectedRoute><SubscriptionStatus /></ProtectedRoute>} />
            <Route path="/subscription/plans" element={<SubscriptionPlans />} />
            <Route path="/subscription/manage" element={<ProtectedRoute><SubscriptionManagement /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
