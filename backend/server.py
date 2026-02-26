from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import string
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from bs4 import BeautifulSoup
import asyncio
import re
import chromadb
import razorpay
import hmac
import hashlib
import google.generativeai as genai


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Razorpay client
razorpay_client = None
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET')
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    logging.info("Razorpay client initialized")

# Subscription Plans
SUBSCRIPTION_PLANS = {
    "starter": {
        "name": "Starter",
        "price": 9900,  # in paise (₹99)
        "price_display": "₹99",
        "bots_allowed": 1,
        "description": "1 bot allowed"
    },
    "basic": {
        "name": "Basic",
        "price": 14900,  # in paise (₹149)
        "price_display": "₹149",
        "bots_allowed": 3,
        "description": "3 bots allowed"
    },
    "pro": {
        "name": "Pro",
        "price": 19900,  # in paise (₹199)
        "price_display": "₹199",
        "bots_allowed": -1,  # -1 means unlimited
        "description": "Unlimited bots"
    }
}

# ChromaDB Cloud connection
chroma_client = None
try:
    chroma_api_key = os.environ.get('CHROMA_API_KEY')
    chroma_tenant = os.environ.get('CHROMA_TENANT')
    chroma_database = os.environ.get('CHROMA_DATABASE')
    
    if chroma_api_key and chroma_tenant and chroma_database:
        chroma_client = chromadb.CloudClient(
            api_key=chroma_api_key,
            tenant=chroma_tenant,
            database=chroma_database
        )
        logging.info("ChromaDB Cloud connected successfully")
    else:
        logging.warning("ChromaDB credentials not fully configured")
except Exception as e:
    logging.error(f"ChromaDB connection failed: {e}")
    chroma_client = None

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7  # 7 days

# OTP settings
OTP_EXPIRY_MINUTES = 10

# Create the main app
app = FastAPI(title="ContextLink AI API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class OTPRequest(BaseModel):
    email: EmailStr

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: str

class BotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    personality: str = Field(default="You are a helpful AI assistant.")
    welcome_message: str = Field(default="Hello! How can I help you today?")

class BotUpdate(BaseModel):
    name: Optional[str] = None
    personality: Optional[str] = None
    welcome_message: Optional[str] = None

class BotResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    personality: str
    welcome_message: str
    user_id: str
    created_at: str
    updated_at: str
    document_count: int = 0
    is_trained: bool = False
    public_id: str

class URLTrainingRequest(BaseModel):
    bot_id: str
    urls: List[str]

class TrainingStatusResponse(BaseModel):
    bot_id: str
    status: str
    progress: int
    total_urls: int
    processed_urls: int
    message: str

class ChatMessage(BaseModel):
    bot_id: str
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    sources: List[str] = []

class EmbedCodeResponse(BaseModel):
    public_url: str
    embed_script: str
    bot_id: str
    bot_name: str

class DashboardStats(BaseModel):
    total_bots: int
    active_bots: int
    total_documents: int
    total_chats: int
    total_tokens_used: int
    subscription: Optional[Dict] = None
    bots_remaining: int = 0

# Subscription Models
class SubscriptionPlan(BaseModel):
    plan_id: str
    name: str
    price: int
    price_display: str
    bots_allowed: int
    description: str

class CreateOrderRequest(BaseModel):
    plan_id: str

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    plan: Dict

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str

class SubscriptionResponse(BaseModel):
    plan_id: str
    plan_name: str
    bots_allowed: int
    bots_used: int
    status: str
    expires_at: str
    created_at: str

class DeleteURLRequest(BaseModel):
    bot_id: str
    source_url: str

class AddURLsRequest(BaseModel):
    bot_id: str
    urls: List[str]

# ==================== HELPER FUNCTIONS ====================

async def get_user_subscription(user_id: str) -> Optional[Dict]:
    """Get user's active subscription"""
    subscription = await db.subscriptions.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    if subscription:
        # Check if expired
        expires_at = datetime.fromisoformat(subscription["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            await db.subscriptions.update_one(
                {"id": subscription["id"]},
                {"$set": {"status": "expired"}}
            )
            return None
    return subscription

async def get_user_bots_count(user_id: str) -> int:
    """Get count of user's bots"""
    return await db.bots.count_documents({"user_id": user_id})

async def can_create_bot(user_id: str) -> tuple[bool, str]:
    """Check if user can create a bot based on subscription"""
    subscription = await get_user_subscription(user_id)
    bots_count = await get_user_bots_count(user_id)
    
    if not subscription:
        # No subscription - allow 0 bots (must subscribe)
        return False, "Please subscribe to a plan to create bots"
    
    plan = SUBSCRIPTION_PLANS.get(subscription["plan_id"])
    if not plan:
        return False, "Invalid subscription plan"
    
    bots_allowed = plan["bots_allowed"]
    if bots_allowed == -1:  # Unlimited
        return True, "OK"
    
    if bots_count >= bots_allowed:
        return False, f"You have reached your limit of {bots_allowed} bot(s). Upgrade your plan to create more."
    
    return True, "OK"

def delete_bot_from_chroma(bot_id: str):
    """Delete a bot's collection from ChromaDB"""
    if not chroma_client:
        return
    try:
        collection_name = f"bot_{bot_id.replace('-', '_')}"
        chroma_client.delete_collection(collection_name)
        logger.info(f"Deleted ChromaDB collection: {collection_name}")
    except Exception as e:
        logger.error(f"Error deleting ChromaDB collection: {e}")

def get_bot_collection(bot_id: str):
    """Get or create a ChromaDB collection for a bot"""
    if not chroma_client:
        return None
    try:
        collection = chroma_client.get_or_create_collection(
            name=f"bot_{bot_id.replace('-', '_')}",
            metadata={"bot_id": bot_id}
        )
        return collection
    except Exception as e:
        logger.error(f"Error getting ChromaDB collection: {e}")
        return None

def add_documents_to_chroma(bot_id: str, documents: List[Dict]) -> int:
    """Add documents to ChromaDB collection"""
    collection = get_bot_collection(bot_id)
    if not collection:
        return 0
    
    try:
        ids = [doc["id"] for doc in documents]
        texts = [doc["content"] for doc in documents]
        metadatas = [{"source_url": doc["source_url"], "chunk_index": doc["chunk_index"]} for doc in documents]
        
        collection.add(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )
        return len(ids)
    except Exception as e:
        logger.error(f"Error adding to ChromaDB: {e}")
        return 0

def search_similar_documents(bot_id: str, query: str, n_results: int = 5) -> List[Dict]:
    """Search for similar documents in ChromaDB"""
    collection = get_bot_collection(bot_id)
    if not collection:
        return []
    
    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )
        
        similar_docs = []
        if results and results["ids"] and len(results["ids"]) > 0:
            for i, doc_id in enumerate(results["ids"][0]):
                similar_docs.append({
                    "id": doc_id,
                    "content": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0.0
                })
        return similar_docs
    except Exception as e:
        logger.error(f"Error searching ChromaDB: {e}")
        return []

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def create_jwt_token(user_id: str, email: str) -> str:
    """Create JWT token"""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> Optional[Dict]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """Get current user from JWT token"""
    payload = verify_jwt_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# async def send_otp_email(email: str, otp: str) -> bool:
#     """Send OTP via Brevo SMTP"""
#     smtp_host = os.environ.get('BREVO_SMTP_HOST', 'smtp-relay.brevo.com')
#     smtp_port = int(os.environ.get('BREVO_SMTP_PORT', 587))
#     smtp_user = os.environ.get('BREVO_SMTP_USER')
#     smtp_password = os.environ.get('BREVO_SMTP_PASSWORD')
#     sender_email = os.environ.get('BREVO_SENDER_EMAIL', smtp_user)
#     sender_name = os.environ.get('BREVO_SENDER_NAME', 'ContextLink AI')
    
#     if not smtp_user or not smtp_password:
#         logger.warning("SMTP credentials not configured, OTP not sent")
#         return False
    
#     html_content = f"""
#     <html>
#         <body style="font-family: 'Space Grotesk', Arial, sans-serif; background-color: #fafafa; padding: 40px;">
#             <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
#                 <h1 style="color: #0d9488; margin-bottom: 24px; font-size: 24px;">ContextLink AI</h1>
#                 <p style="color: #333; font-size: 16px; margin-bottom: 16px;">Your verification code is:</p>
#                 <h2 style="font-size: 36px; letter-spacing: 8px; color: #0d9488; text-align: center; padding: 20px; background: #f0fdfa; border-radius: 8px; margin: 24px 0;">{otp}</h2>
#                 <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
#                 <p style="color: #666; font-size: 14px; margin-top: 24px;">If you didn't request this code, please ignore this email.</p>
#             </div>
#         </body>
#     </html>
#     """
    
#     message = MIMEMultipart('alternative')
#     message['Subject'] = f"Your ContextLink AI verification code: {otp}"
#     message['From'] = f"{sender_name} <{sender_email}>"
#     message['To'] = email
#     message.attach(MIMEText(html_content, 'html'))
    
#     try:
#         async with aiosmtplib.SMTP(hostname=smtp_host, port=smtp_port, start_tls=True) as smtp:
#             await smtp.login(smtp_user, smtp_password)
#             await smtp.send_message(message)
#         logger.info(f"OTP email sent to {email}")
#         return True
#     except Exception as e:
#         logger.error(f"Failed to send OTP email: {e}")
#         return False

async def send_otp_email(email: str, otp: str) -> bool:
    """Send OTP via Brevo HTTP API"""
    
    brevo_api_key = os.environ.get("BREVO_API_KEY")
    smtp_user = os.environ.get('BREVO_SMTP_USER')
    sender_email = os.environ.get('BREVO_SENDER_EMAIL', smtp_user)
    sender_name = os.environ.get('BREVO_SENDER_NAME', 'ContextLink AI')

    if not brevo_api_key:
        logger.warning("Brevo API key not configured, OTP not sent")
        return False

    html_content = f"""
    <html>
        <body style="font-family: 'Space Grotesk', Arial, sans-serif; background-color: #fafafa; padding: 40px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #0d9488; margin-bottom: 24px; font-size: 24px;">ContextLink AI</h1>
                <p style="color: #333; font-size: 16px; margin-bottom: 16px;">Your verification code is:</p>
                <h2 style="font-size: 36px; letter-spacing: 8px; color: #0d9488; text-align: center; padding: 20px; background: #f0fdfa; border-radius: 8px; margin: 24px 0;">{otp}</h2>
                <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                <p style="color: #666; font-size: 14px; margin-top: 24px;">If you didn't request this code, please ignore this email.</p>
            </div>
        </body>
    </html>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "accept": "application/json",
                    "api-key": brevo_api_key,
                    "content-type": "application/json"
                },
                json={
                    "sender": {
                        "name": sender_name,
                        "email": sender_email
                    },
                    "to": [
                        {"email": email}
                    ],
                    "subject": f"Your ContextLink AI verification code: {otp}",
                    "htmlContent": html_content
                }
            )

        if response.status_code in [200, 201, 202]:
            logger.info(f"OTP email sent to {email}")
            return True
        else:
            logger.error(f"Brevo API error: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"Failed to send OTP email: {e}")
        return False


async def scrape_url(url: str) -> Optional[str]:
    """Scrape content from a URL"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Remove script and style elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                element.decompose()
            
            # Get text content
            text = soup.get_text(separator=' ', strip=True)
            
            # Clean up whitespace
            text = re.sub(r'\s+', ' ', text)
            
            return text[:50000] if len(text) > 50000 else text  # Limit to 50k chars
    except Exception as e:
        logger.error(f"Error scraping {url}: {e}")
        return None

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks"""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/request-otp")
async def request_otp(request: OTPRequest):
    """Request OTP for login/signup"""
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    
    # Store OTP in database
    await db.otps.update_one(
        {"email": request.email},
        {
            "$set": {
                "email": request.email,
                "otp": otp,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Send OTP email
    email_sent = await send_otp_email(request.email, otp)
    
    return {
        "message": "OTP sent to your email" if email_sent else "OTP generated (email not configured)",
        "email": request.email,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
        "email_sent": email_sent
    }

@api_router.post("/auth/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerify):
    """Verify OTP and return JWT token"""
    # Find OTP record
    otp_record = await db.otps.find_one({"email": request.email}, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found for this email")
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_one({"email": request.email})
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    # Verify OTP
    if not secrets.compare_digest(otp_record["otp"], request.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Delete used OTP
    await db.otps.delete_one({"email": request.email})
    
    # Find or create user
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "email": request.email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    # Create JWT token
    token = create_jwt_token(user["id"], user["email"])
    
    return TokenResponse(
        access_token=token,
        user={"id": user["id"], "email": user["email"], "created_at": user["created_at"]}
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: Dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(id=user["id"], email=user["email"], created_at=user["created_at"])

# ==================== SUBSCRIPTION & PAYMENT ROUTES ====================

@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    plans = []
    for plan_id, plan in SUBSCRIPTION_PLANS.items():
        plans.append({
            "plan_id": plan_id,
            **plan
        })
    return {"plans": plans}

@api_router.get("/subscription/current")
async def get_current_subscription(user: Dict = Depends(get_current_user)):
    """Get user's current subscription"""
    subscription = await get_user_subscription(user["id"])
    bots_count = await get_user_bots_count(user["id"])
    
    if not subscription:
        return {
            "has_subscription": False,
            "bots_used": bots_count,
            "bots_allowed": 0,
            "message": "No active subscription"
        }
    
    plan = SUBSCRIPTION_PLANS.get(subscription["plan_id"], {})
    bots_allowed = plan.get("bots_allowed", 0)
    
    return {
        "has_subscription": True,
        "subscription": subscription,
        "plan": plan,
        "bots_used": bots_count,
        "bots_allowed": bots_allowed,
        "bots_remaining": -1 if bots_allowed == -1 else max(0, bots_allowed - bots_count)
    }

@api_router.post("/subscription/create-order", response_model=CreateOrderResponse)
async def create_subscription_order(request: CreateOrderRequest, user: Dict = Depends(get_current_user)):
    """Create a Razorpay order for subscription"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    plan = SUBSCRIPTION_PLANS.get(request.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    try:
        order = razorpay_client.order.create({
            "amount": plan["price"],
            "currency": "INR",
            "payment_capture": 1,
            "notes": {
                "user_id": user["id"],
                "plan_id": request.plan_id,
                "user_email": user["email"]
            }
        })
        
        # Store order in database
        order_record = {
            "id": str(uuid.uuid4()),
            "razorpay_order_id": order["id"],
            "user_id": user["id"],
            "plan_id": request.plan_id,
            "amount": plan["price"],
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.orders.insert_one(order_record)
        
        return CreateOrderResponse(
            order_id=order["id"],
            amount=plan["price"],
            currency="INR",
            key_id=RAZORPAY_KEY_ID,
            plan=plan
        )
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order")

@api_router.post("/subscription/verify-payment")
async def verify_payment(request: VerifyPaymentRequest, user: Dict = Depends(get_current_user)):
    """Verify Razorpay payment and activate subscription"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    # Verify signature
    try:
        message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != request.razorpay_signature:
            raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")
    
    plan = SUBSCRIPTION_PLANS.get(request.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Update order status
    await db.orders.update_one(
        {"razorpay_order_id": request.razorpay_order_id},
        {
            "$set": {
                "razorpay_payment_id": request.razorpay_payment_id,
                "status": "paid",
                "paid_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Deactivate any existing subscription
    await db.subscriptions.update_many(
        {"user_id": user["id"], "status": "active"},
        {"$set": {"status": "cancelled"}}
    )
    
    # Create new subscription
    subscription = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "plan_id": request.plan_id,
        "plan_name": plan["name"],
        "bots_allowed": plan["bots_allowed"],
        "razorpay_order_id": request.razorpay_order_id,
        "razorpay_payment_id": request.razorpay_payment_id,
        "amount": plan["price"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    }
    await db.subscriptions.insert_one(subscription)
    
    logger.info(f"Subscription activated for user {user['id']}: {plan['name']}")
    
    return {
        "success": True,
        "message": f"Subscription to {plan['name']} plan activated!",
        "subscription": {
            "plan_id": request.plan_id,
            "plan_name": plan["name"],
            "bots_allowed": plan["bots_allowed"],
            "expires_at": subscription["expires_at"]
        }
    }

# ==================== BOT ROUTES ====================

@api_router.post("/bots", response_model=BotResponse)
async def create_bot(bot: BotCreate, user: Dict = Depends(get_current_user)):
    """Create a new bot"""
    # Check subscription limits
    can_create, message = await can_create_bot(user["id"])
    if not can_create:
        raise HTTPException(status_code=403, detail=message)
    
    bot_data = {
        "id": str(uuid.uuid4()),
        "public_id": secrets.token_urlsafe(8),
        "name": bot.name,
        "personality": bot.personality,
        "welcome_message": bot.welcome_message,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "document_count": 0,
        "is_trained": False
    }
    
    await db.bots.insert_one(bot_data)
    
    return BotResponse(**bot_data)

@api_router.get("/bots", response_model=List[BotResponse])
async def list_bots(user: Dict = Depends(get_current_user)):
    """List all bots for current user"""
    bots = await db.bots.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [BotResponse(**bot) for bot in bots]

@api_router.get("/bots/{bot_id}", response_model=BotResponse)
async def get_bot(bot_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific bot"""
    bot = await db.bots.find_one({"id": bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return BotResponse(**bot)

@api_router.put("/bots/{bot_id}", response_model=BotResponse)
async def update_bot(bot_id: str, update: BotUpdate, user: Dict = Depends(get_current_user)):
    """Update a bot"""
    bot = await db.bots.find_one({"id": bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.bots.update_one({"id": bot_id}, {"$set": update_data})
    
    updated_bot = await db.bots.find_one({"id": bot_id}, {"_id": 0})
    return BotResponse(**updated_bot)

@api_router.delete("/bots/{bot_id}")
async def delete_bot(bot_id: str, user: Dict = Depends(get_current_user)):
    """Delete a bot"""
    result = await db.bots.delete_one({"id": bot_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Delete from ChromaDB
    delete_bot_from_chroma(bot_id)
    
    # Also delete associated documents and chat history
    await db.documents.delete_many({"bot_id": bot_id})
    await db.chats.delete_many({"bot_id": bot_id})
    
    return {"message": "Bot deleted successfully"}

# ==================== URL MANAGEMENT ROUTES ====================

@api_router.delete("/training/url")
async def delete_training_url(request: DeleteURLRequest, user: Dict = Depends(get_current_user)):
    """Delete a specific URL's documents from a bot"""
    # Verify bot ownership
    bot = await db.bots.find_one({"id": request.bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Get document IDs to delete from ChromaDB
    docs_to_delete = await db.documents.find(
        {"bot_id": request.bot_id, "source_url": request.source_url},
        {"id": 1, "_id": 0}
    ).to_list(1000)
    
    doc_ids = [doc["id"] for doc in docs_to_delete]
    
    # Delete from ChromaDB
    if chroma_client and doc_ids:
        collection = get_bot_collection(request.bot_id)
        if collection:
            try:
                collection.delete(ids=doc_ids)
                logger.info(f"Deleted {len(doc_ids)} docs from ChromaDB for URL: {request.source_url}")
            except Exception as e:
                logger.error(f"Error deleting from ChromaDB: {e}")
    
    # Delete from MongoDB
    result = await db.documents.delete_many({"bot_id": request.bot_id, "source_url": request.source_url})
    
    # Update bot document count
    remaining_count = await db.documents.count_documents({"bot_id": request.bot_id})
    await db.bots.update_one(
        {"id": request.bot_id},
        {
            "$set": {
                "document_count": remaining_count,
                "is_trained": remaining_count > 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": f"Deleted {result.deleted_count} documents from URL: {request.source_url}",
        "deleted_count": result.deleted_count,
        "remaining_documents": remaining_count
    }

@api_router.post("/training/add-urls")
async def add_more_urls(request: AddURLsRequest, background_tasks: BackgroundTasks, user: Dict = Depends(get_current_user)):
    """Add more URLs to an existing bot"""
    # Verify bot ownership
    bot = await db.bots.find_one({"id": request.bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Filter out already trained URLs
    existing_urls = await db.documents.distinct("source_url", {"bot_id": request.bot_id})
    new_urls = [url for url in request.urls if url not in existing_urls]
    
    if not new_urls:
        return {"message": "All URLs have already been trained", "new_urls": 0}
    
    # Initialize training status
    training_status[request.bot_id] = {
        "status": "processing",
        "progress": 0,
        "total_urls": len(new_urls),
        "processed_urls": 0,
        "message": "Adding new URLs..."
    }
    
    # Start background training
    background_tasks.add_task(process_training, request.bot_id, new_urls, user["id"])
    
    return TrainingStatusResponse(
        bot_id=request.bot_id,
        **training_status[request.bot_id]
    )

@api_router.get("/training/urls/{bot_id}")
async def get_trained_urls(bot_id: str, user: Dict = Depends(get_current_user)):
    """Get all trained URLs for a bot"""
    bot = await db.bots.find_one({"id": bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Get unique URLs with chunk counts
    pipeline = [
        {"$match": {"bot_id": bot_id}},
        {"$group": {
            "_id": "$source_url",
            "chunk_count": {"$sum": 1},
            "created_at": {"$first": "$created_at"}
        }},
        {"$sort": {"created_at": -1}}
    ]
    
    urls = []
    async for doc in db.documents.aggregate(pipeline):
        urls.append({
            "url": doc["_id"],
            "chunk_count": doc["chunk_count"],
            "created_at": doc["created_at"]
        })
    
    return {"urls": urls, "total_urls": len(urls)}

# ==================== TRAINING ROUTES ====================

# Store training status in memory (for real-time updates)
training_status: Dict[str, Dict] = {}

@api_router.post("/training/start")
async def start_training(request: URLTrainingRequest, background_tasks: BackgroundTasks, user: Dict = Depends(get_current_user)):
    """Start training a bot with URLs"""
    # Verify bot ownership
    bot = await db.bots.find_one({"id": request.bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    # Initialize training status
    training_status[request.bot_id] = {
        "status": "processing",
        "progress": 0,
        "total_urls": len(request.urls),
        "processed_urls": 0,
        "message": "Starting training..."
    }
    
    # Start background training
    background_tasks.add_task(process_training, request.bot_id, request.urls, user["id"])
    
    return TrainingStatusResponse(
        bot_id=request.bot_id,
        **training_status[request.bot_id]
    )

async def process_training(bot_id: str, urls: List[str], user_id: str):
    """Background task to process URL training"""
    total_docs = 0
    all_documents = []
    
    for i, url in enumerate(urls):
        training_status[bot_id]["message"] = f"Scraping: {url}"
        training_status[bot_id]["processed_urls"] = i
        training_status[bot_id]["progress"] = int((i / len(urls)) * 80)  # 80% for scraping
        
        # Scrape URL
        content = await scrape_url(url)
        if not content:
            continue
        
        # Chunk content
        chunks = chunk_text(content)
        
        # Store chunks in database and collect for ChromaDB
        for j, chunk in enumerate(chunks):
            doc = {
                "id": str(uuid.uuid4()),
                "bot_id": bot_id,
                "user_id": user_id,
                "source_url": url,
                "content": chunk,
                "chunk_index": j,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.documents.insert_one(doc)
            all_documents.append(doc)
            total_docs += 1
    
    # Add to ChromaDB for vector search
    training_status[bot_id]["message"] = "Indexing documents for similarity search..."
    training_status[bot_id]["progress"] = 90
    
    if chroma_client and all_documents:
        chroma_docs_added = add_documents_to_chroma(bot_id, all_documents)
        logger.info(f"Added {chroma_docs_added} documents to ChromaDB for bot {bot_id}")
    
    # Update bot status
    await db.bots.update_one(
        {"id": bot_id},
        {
            "$set": {
                "document_count": total_docs,
                "is_trained": total_docs > 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    training_status[bot_id] = {
        "status": "completed",
        "progress": 100,
        "total_urls": len(urls),
        "processed_urls": len(urls),
        "message": f"Training complete! {total_docs} documents indexed with vector embeddings."
    }

@api_router.get("/training/status/{bot_id}", response_model=TrainingStatusResponse)
async def get_training_status(bot_id: str, user: Dict = Depends(get_current_user)):
    """Get training status for a bot"""
    if bot_id not in training_status:
        # Check if bot exists and is trained
        bot = await db.bots.find_one({"id": bot_id, "user_id": user["id"]}, {"_id": 0})
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        
        if bot.get("is_trained"):
            return TrainingStatusResponse(
                bot_id=bot_id,
                status="completed",
                progress=100,
                total_urls=0,
                processed_urls=0,
                message=f"Bot is trained with {bot.get('document_count', 0)} documents"
            )
        else:
            return TrainingStatusResponse(
                bot_id=bot_id,
                status="idle",
                progress=0,
                total_urls=0,
                processed_urls=0,
                message="No training in progress"
            )
    
    return TrainingStatusResponse(bot_id=bot_id, **training_status[bot_id])

@api_router.get("/training/documents/{bot_id}")
async def get_bot_documents(bot_id: str, user: Dict = Depends(get_current_user)):
    """Get all documents for a bot"""
    bot = await db.bots.find_one({"id": bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    docs = await db.documents.find({"bot_id": bot_id}, {"_id": 0}).to_list(1000)
    
    # Group by source URL
    grouped = {}
    for doc in docs:
        url = doc["source_url"]
        if url not in grouped:
            grouped[url] = {"url": url, "chunks": 0, "created_at": doc["created_at"]}
        grouped[url]["chunks"] += 1
    
    return {"documents": list(grouped.values()), "total_chunks": len(docs)}

# ==================== CHAT ROUTES ====================

@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(message: ChatMessage, user: Dict = Depends(get_current_user)):
    """Chat with a trained bot"""
    # Verify bot ownership
    bot = await db.bots.find_one({"id": message.bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    session_id = message.session_id or str(uuid.uuid4())
    
    # Use ChromaDB for vector similarity search
    relevant_docs = []
    sources = []
    
    if chroma_client:
        # Vector similarity search with ChromaDB
        similar_docs = search_similar_documents(message.bot_id, message.message, n_results=5)
        for doc in similar_docs:
            relevant_docs.append(doc)
            if doc.get("metadata", {}).get("source_url"):
                sources.append(doc["metadata"]["source_url"])
        logger.info(f"ChromaDB returned {len(similar_docs)} similar documents")
    else:
        # Fallback to keyword search if ChromaDB not available
        search_terms = message.message.lower().split()[:5]
        docs = await db.documents.find({"bot_id": message.bot_id}, {"_id": 0}).to_list(100)
        
        scored_docs = []
        for doc in docs:
            content_lower = doc["content"].lower()
            score = sum(1 for term in search_terms if term in content_lower)
            if score > 0:
                scored_docs.append((score, doc))
        
        scored_docs.sort(reverse=True, key=lambda x: x[0])
        for score, doc in scored_docs[:5]:
            relevant_docs.append({"content": doc["content"], "metadata": {"source_url": doc["source_url"]}})
            sources.append(doc["source_url"])
    
    # Remove duplicate sources
    sources = list(set(sources))
    
    # Build context from relevant documents
    context = "\n\n".join([doc.get("content", "")[:500] for doc in relevant_docs])
    
    # Generate response using Gemini
#     llm_key = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('GEMINI_API_KEY')
    
#     if llm_key:
#         try:
#             from emergentintegrations.llm.chat import LlmChat, UserMessage
            
#             system_prompt = f"""You are an AI assistant with the following personality:
# {bot['personality']}

# You have access to the following context information:
# {context if context else 'No relevant context found.'}

# Instructions:
# - Answer based on the provided context when relevant
# - Be helpful, clear, and concise
# - If you don't have enough information, say so
# - Stay in character according to your personality"""

#             chat = LlmChat(
#                 api_key=llm_key,
#                 session_id=f"{message.bot_id}_{session_id}",
#                 system_message=system_prompt
#             ).with_model("gemini", "gemini-3-flash-preview")
            
#             user_msg = UserMessage(text=message.message)
#             response_text = await chat.send_message(user_msg)
            
#         except Exception as e:
#             logger.error(f"LLM error: {e}")
#             response_text = f"I'm here to help! Based on what I know: {context[:200]}..." if context else "I don't have enough training data yet. Please train me with some URLs first!"
#     else:
#         # Fallback response without LLM
#         response_text = f"Based on the information I have: {context[:300]}..." if context else bot.get("welcome_message", "Hello! I'm ready to help once I'm trained with some content.")
    llm_key = os.environ.get("GEMINI_API_KEY")

    if llm_key:
        print("context ======================",context)
        try:
            genai.configure(api_key=llm_key)

            system_prompt = f"""You are an AI assistant with the following personality:
                    {bot['personality']}

                    You have access to the following context information:
                    {context if context else 'No relevant context found.'}

                    Instructions:
                    - Always answer like as a numan naturally do like a chatting.
                    - Answer based on the provided context when relevant 
                    - Be helpful, clear, and concise
                    - If you don't have enough information, say so
                    - Stay in character according to your personality
                    """

            model = genai.GenerativeModel("gemini-2.5-flash")

            response = model.generate_content(
                [
                    {"role": "user", "parts": [system_prompt]},
                    {"role": "user", "parts": [message.message]},
                ]
            )

            response_text = response.text

        except Exception as e:
            logger.error(f"LLM error: {e}")
            response_text = (
                f"I'm here to help! Based on what I know: {context[:200]}..."
                if context
                else "I don't have enough training data yet. Please train me with some URLs first!"
            )
    else:
        # Fallback response without LLM
        response_text = (
            f"Based on the information I have: {context[:300]}..."
            if context
            else bot.get("welcome_message", "Hello! I'm ready to help once I'm trained with some content.")
        )
    # Store chat message
    chat_record = {
        "id": str(uuid.uuid4()),
        "bot_id": message.bot_id,
        "session_id": session_id,
        "user_id": user["id"],
        "user_message": message.message,
        "bot_response": response_text,
        "sources": sources,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chats.insert_one(chat_record)
    
    # Update usage stats
    await db.stats.update_one(
        {"user_id": user["id"]},
        {
            "$inc": {"total_chats": 1, "tokens_used": len(message.message) + len(response_text)},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return ChatResponse(response=response_text, session_id=session_id, sources=sources)

@api_router.get("/chat/history/{bot_id}")
async def get_chat_history(bot_id: str, session_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """Get chat history for a bot"""
    query = {"bot_id": bot_id, "user_id": user["id"]}
    if session_id:
        query["session_id"] = session_id
    
    chats = await db.chats.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"chats": chats}

# ==================== PUBLIC BOT ROUTES (No Auth) ====================

@api_router.get("/public/bot/{public_id}")
async def get_public_bot(public_id: str):
    """Get public bot info for embedding"""
    bot = await db.bots.find_one({"public_id": public_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    return {
        "id": bot["id"],
        "public_id": bot["public_id"],
        "name": bot["name"],
        "welcome_message": bot["welcome_message"],
        "is_trained": bot.get("is_trained", False)
    }

@api_router.post("/public/chat/{public_id}")
async def public_chat(public_id: str, message: Dict):
    """Chat with a public bot (for embedded widget)"""
    bot = await db.bots.find_one({"public_id": public_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    user_message = message.get("message", "")
    session_id = message.get("session_id") or str(uuid.uuid4())
    
    # Use ChromaDB for vector similarity search
    relevant_docs = []
    
    if chroma_client:
        similar_docs = search_similar_documents(bot["id"], user_message, n_results=5)
        relevant_docs = similar_docs
    else:
        # Fallback to keyword search
        docs = await db.documents.find({"bot_id": bot["id"]}, {"_id": 0}).to_list(100)
        search_terms = user_message.lower().split()[:5]
        scored_docs = []
        for doc in docs:
            content_lower = doc["content"].lower()
            score = sum(1 for term in search_terms if term in content_lower)
            if score > 0:
                scored_docs.append((score, doc))
        scored_docs.sort(reverse=True, key=lambda x: x[0])
        for score, doc in scored_docs[:5]:
            relevant_docs.append({"content": doc["content"]})
    
    context = "\n\n".join([doc.get("content", "")[:500] for doc in relevant_docs])
    
#     # Generate response
#     llm_key = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('GEMINI_API_KEY')
    
#     if llm_key:
#         try:
#             from emergentintegrations.llm.chat import LlmChat, UserMessage
            
#             system_prompt = f"""{bot['personality']}

# Context:
# {context if context else 'No relevant context found.'}

# Be helpful and concise."""

#             chat = LlmChat(
#                 api_key=llm_key,
#                 session_id=f"public_{bot['id']}_{session_id}",
#                 system_message=system_prompt
#             ).with_model("gemini", "gemini-3-flash-preview")
            
#             response_text = await chat.send_message(UserMessage(text=user_message))
#         except Exception as e:
#             logger.error(f"LLM error: {e}")
#             response_text = context[:200] + "..." if context else bot.get("welcome_message", "Hello!")
#     else:
#         response_text = context[:200] + "..." if context else bot.get("welcome_message", "Hello!")
    # Generate response
    llm_key = os.environ.get('GEMINI_API_KEY')

    if llm_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=llm_key)

            system_prompt = f"""{bot['personality']}

    Context:
    {context if context else 'No relevant context found.'}

    Be helpful and concise."""

            model = genai.GenerativeModel("gemini-1.5-flash")

            response = model.generate_content(
                f"{system_prompt}\n\nUser:\n{user_message}"
            )

            response_text = response.text

        except Exception as e:
            logger.error(f"LLM error: {e}")
            response_text = context[:200] + "..." if context else bot.get("welcome_message", "Hello!")
    else:
        response_text = context[:200] + "..." if context else bot.get("welcome_message", "Hello!")
    # Update stats
    await db.stats.update_one(
        {"user_id": bot["user_id"]},
        {"$inc": {"total_chats": 1, "tokens_used": len(user_message) + len(response_text)}},
        upsert=True
    )
    
    return {"response": response_text, "session_id": session_id}

# ==================== EMBED ROUTES ====================

@api_router.get("/embed/{bot_id}", response_model=EmbedCodeResponse)
async def get_embed_code(bot_id: str, user: Dict = Depends(get_current_user)):
    """Get embed code for a bot"""
    bot = await db.bots.find_one({"id": bot_id, "user_id": user["id"]}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://ai-chatbot-forge.preview.emergentagent.com')
    
    public_url = f"{frontend_url}/chat/{bot['public_id']}"
    
    embed_script = f'''<script>
(function() {{
  var iframe = document.createElement('iframe');
  iframe.src = '{public_url}?embed=true';
  iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:9999;';
  iframe.allow = 'microphone';
  document.body.appendChild(iframe);
}})();
</script>'''
    
    return EmbedCodeResponse(
        public_url=public_url,
        embed_script=embed_script,
        bot_id=bot_id,
        bot_name=bot["name"]
    )

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: Dict = Depends(get_current_user)):
    """Get dashboard statistics"""
    # Count bots
    total_bots = await db.bots.count_documents({"user_id": user["id"]})
    active_bots = await db.bots.count_documents({"user_id": user["id"], "is_trained": True})
    
    # Count documents
    total_documents = await db.documents.count_documents({"user_id": user["id"]})
    
    # Get stats
    stats = await db.stats.find_one({"user_id": user["id"]}, {"_id": 0})
    
    # Get subscription info
    subscription = await get_user_subscription(user["id"])
    subscription_info = None
    bots_remaining = 0
    
    if subscription:
        plan = SUBSCRIPTION_PLANS.get(subscription["plan_id"], {})
        bots_allowed = plan.get("bots_allowed", 0)
        bots_remaining = -1 if bots_allowed == -1 else max(0, bots_allowed - total_bots)
        subscription_info = {
            "plan_id": subscription["plan_id"],
            "plan_name": plan.get("name", "Unknown"),
            "bots_allowed": bots_allowed,
            "expires_at": subscription["expires_at"],
            "status": subscription["status"]
        }
    
    return {
        "total_bots": total_bots,
        "active_bots": active_bots,
        "total_documents": total_documents,
        "total_chats": stats.get("total_chats", 0) if stats else 0,
        "total_tokens_used": stats.get("tokens_used", 0) if stats else 0,
        "subscription": subscription_info,
        "bots_remaining": bots_remaining
    }

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
