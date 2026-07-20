from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import asyncpg
from db.database import get_db
from auth.models import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from auth.security import verify_password, get_password_hash, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM
from auth.dependencies import get_current_user
from jose import jwt, JWTError

router = APIRouter(prefix="/auth", tags=["auth"])

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/register", response_model=UserResponse)
async def register_user(request: RegisterRequest, db: asyncpg.Connection = Depends(get_db)):
    # Check if user already exists
    existing_user = await db.fetchrow("SELECT id FROM users WHERE email = $1", request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(request.password)
    
    # Insert new user
    user = await db.fetchrow(
        """
        INSERT INTO users (email, password_hash, full_name, role, company)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, role, company
        """,
        request.email, hashed_password, request.full_name, request.role, request.company
    )
    
    return UserResponse(
        id=str(user["id"]),
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        company=user["company"]
    )

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: asyncpg.Connection = Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        request.email
    )
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(subject=str(user["id"]))
    refresh_token = create_refresh_token(subject=str(user["id"]))
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@router.post("/token", response_model=TokenResponse)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: asyncpg.Connection = Depends(get_db)):
    user = await db.fetchrow(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        form_data.username
    )
    
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(subject=str(user["id"]))
    refresh_token = create_refresh_token(subject=str(user["id"]))
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: asyncpg.Connection = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # Check if user exists
    user = await db.fetchrow("SELECT id FROM users WHERE id = $1", user_id)
    if not user:
        raise credentials_exception

    access_token = create_access_token(subject=user_id)
    new_refresh_token = create_refresh_token(subject=user_id)
    
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user
