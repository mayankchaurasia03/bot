# ContextLink AI - Product Requirements Document

## Original Problem Statement
Build ContextLink AI - A RAG-based chatbot builder platform with:
- Email OTP authentication (no password)
- Dashboard with usage metrics
- Train Bot with URL scraping
- Bot Playground for testing
- Share & Embed code generation
- Light/Dark theme toggle
- ChromaDB for vector similarity search
- Gemini 3 Flash for LLM responses

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: Python FastAPI
- **Database**: MongoDB (users, bots, documents, chats, stats)
- **Vector Store**: ChromaDB Cloud
- **LLM**: Gemini 3 Flash via Emergent LLM Key
- **Email**: Brevo SMTP for OTP delivery

## User Personas
1. **Developers** - Want quick AI chatbot integration for their apps
2. **Business Owners** - Need customer support automation
3. **Content Creators** - Want to make their content interactive

## Core Requirements - ALL IMPLEMENTED ✅

### Authentication
- [x] Email-based OTP authentication (Brevo SMTP)
- [x] JWT token management
- [x] Protected routes

### Dashboard
- [x] Stats cards (bots, documents, chats, tokens)
- [x] Bot listing with status

### Bot Training
- [x] URL scraping
- [x] Text chunking
- [x] ChromaDB vector embeddings
- [x] Progress tracking

### Chat Playground
- [x] Vector similarity search (ChromaDB)
- [x] Gemini LLM responses
- [x] Source attribution
- [x] Session management

### Share & Embed
- [x] Public URLs
- [x] JavaScript embed snippets
- [x] Embeddable widget

### UI/UX
- [x] Light/Dark theme toggle
- [x] Modern design (Space Grotesk + Manrope)
- [x] Responsive layout

## What's Been Implemented (Feb 21, 2026)

### Backend APIs
- Auth: `/api/auth/request-otp`, `/api/auth/verify-otp`, `/api/auth/me`
- Bots: CRUD operations at `/api/bots`
- Training: `/api/training/start`, `/api/training/status/:botId`
- Chat: `/api/chat`, `/api/public/chat/:publicId`
- Embed: `/api/embed/:botId`
- Dashboard: `/api/dashboard/stats`

### Frontend Pages
- AuthPage - Email OTP login/signup
- DashboardPage - Stats + bot list
- TrainBotPage - 3-step wizard (info → URLs → training)
- PlaygroundPage - Chat, settings, embed tabs
- PublicChatPage - Embeddable chat widget

### Integrations - ALL CONFIGURED ✅
- ✅ Gemini 3 Flash via Emergent LLM Key
- ✅ Brevo SMTP for OTP emails
- ✅ ChromaDB Cloud for vector search

## Environment Configuration
```
CHROMA_API_KEY=ck-4XQSyjUEdQoJZqHUFaqa1mCaLakJGSPQE82c4vatwks8
CHROMA_TENANT=220a7232-91d4-4046-8844-3c03954224d1
CHROMA_DATABASE=ContextLink
BREVO_SMTP_USER=a2f527001@smtp-brevo.com
BREVO_SENDER_EMAIL=mayankchaurasia011@gmail.com
EMERGENT_LLM_KEY=sk-emergent-***
```

## Prioritized Backlog

### P1 (Improvements)
- [ ] Rate limiting on API endpoints
- [ ] Better chunking strategies
- [ ] Chat history persistence

### P2 (Nice to Have)
- [ ] Multiple embedding models
- [ ] Bot analytics dashboard
- [ ] Webhook notifications
- [ ] Custom bot appearance

## Next Tasks
1. Test full flow manually: login → create bot → train → chat
2. Add rate limiting middleware
3. Consider adding Stripe for usage-based billing
