#!/bin/bash

echo "🔧 Installing enhanced security dependencies for MedHub..."

# Backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install express-rate-limit@^7.1.5 cookie-parser@^1.4.6

# Frontend dependencies (if any additional ones needed)
echo "📦 Checking frontend dependencies..."
cd ../frontend
# No additional frontend dependencies needed for this implementation

echo "✅ All dependencies installed successfully!"
echo ""
echo "🔐 Enhanced Security Features Added:"
echo "  ✓ Dual-token authentication (Access + Refresh)"
echo "  ✓ HttpOnly secure cookies for refresh tokens"
echo "  ✓ Rate limiting for authentication endpoints"
echo "  ✓ Account lockout protection"
echo "  ✓ Enhanced password security"
echo "  ✓ Cross-tab logout synchronization"
echo "  ✓ Automatic token refresh"
echo "  ✓ Token reuse detection"
echo ""
echo "🚀 Next steps:"
echo "  1. Update your .env file with separate JWT secrets"
echo "  2. Run: npm run clear-patients (to reset user data)"
echo "  3. Run: npm run seed (to create sample users)"
echo "  4. Start backend: npm run dev"
echo "  5. Start frontend: npm run dev"
echo ""
echo "🔑 Test with these accounts:"
echo "  Admin: admin@medhub.com / Admin123!"
echo "  Doctor: sarah.johnson@medhub.com / Doctor123!"
echo "  Patient: Create new account with strong password"