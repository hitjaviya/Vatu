# Quick Start Guide - New Features

## 🌍 Environment Configuration (Dev/Prod Switching)

### Setup

1. **Copy the environment template:**
   ```bash
   cd packages/server
   cp .env.example .env
   ```

2. **For Development (Default):**
   ```env
   NODE_ENV=development
   SERVER_URL=http://localhost:5000
   CLIENT_URL=http://localhost:5173
   MONGODB_URI=mongodb://localhost:27017/chat-app-dev
   JWT_SECRET=dev-secret-key
   ```

3. **For Production:**
   ```env
   NODE_ENV=production
   SERVER_URL=https://your-domain.com
   CLIENT_URL=https://your-domain.com
   MONGODB_URI=mongodb://user:pass@host:27017/chat-app
   JWT_SECRET=super-secure-random-string
   ```

### That's It!
Just change `NODE_ENV` and your app switches environments automatically!

---

## 💬 Reply to Messages

### Backend (Already Implemented)

The server now accepts a `replyTo` field when sending messages.

### Frontend Integration Needed

Update your message sending code to include `replyTo`:

```javascript
// When replying to a message
socket.emit('message:send', {
    recipientId: 'userId123',
    content: 'This is my reply!',
    type: 'text',
    replyTo: 'original-message-id'  // ← Add this field
});
```

### Display Replies in UI

When you receive messages, check for the `replyTo` field:

```javascript
socket.on('message:receive', (message) => {
    if (message.replyTo) {
        // This message is a reply
        // Fetch and display the original message
        console.log('Replying to:', message.replyTo);
    }
});
```

---

## 📸 Profile Picture Upload

### API Endpoint

```
POST /api/users/avatar
Headers: Authorization: Bearer <your-jwt-token>
Body: FormData with 'avatar' field (image file)
```

### Frontend Integration Example

```javascript
// HTML
<input type="file" id="avatarInput" accept="image/*" />

// JavaScript
const avatarInput = document.getElementById('avatarInput');

avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch('http://localhost:5000/api/users/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${yourAuthToken}`
            },
            body: formData
        });

        const data = await response.json();
        console.log('Success!', data.avatar);
        // Update UI with new avatar URL: data.avatar
    } catch (error) {
        console.error('Upload failed:', error);
    }
});
```

### React Example

```jsx
const ProfilePictureUpload = () => {
    const [uploading, setUploading] = useState(false);
    const { token } = useAuth(); // Your auth context

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch(`${API_URL}/api/users/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            alert('Avatar updated!');
            // Update user context/state with data.avatar
        } catch (error) {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleUpload}
                disabled={uploading}
            />
            {uploading && <p>Uploading...</p>}
        </div>
    );
};
```

### Validation Rules

- ✅ **Accepted formats:** JPEG, JPG, PNG, GIF, WEBP
- ✅ **Max size:** 2MB (configurable in .env)
- ✅ **Auto-cleanup:** Old avatars are deleted automatically

---

## 🧪 Testing Your Implementation

### 1. Test Environment Switching

```bash
# Terminal 1: Start in development
NODE_ENV=development npm run dev:server
# Should show: Environment: development

# Terminal 2: Start in production (after setting .env)
NODE_ENV=production npm start
# Should show: Environment: production
```

### 2. Test Reply Functionality

Use Socket.io client or browser console:

```javascript
const socket = io('http://localhost:5000');
socket.emit('authenticate', 'your-jwt-token');

// Send original message
socket.emit('message:send', {
    recipientId: 'otherUserId',
    content: 'Hello!'
});

// Listen for the sent message
socket.on('message:sent', (msg) => {
    // Send reply
    socket.emit('message:send', {
        recipientId: 'otherUserId',
        content: 'This is a reply',
        replyTo: msg._id
    });
});
```

### 3. Test Avatar Upload

Using cURL:

```bash
curl -X POST http://localhost:5000/api/users/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "avatar=@/path/to/your/image.jpg"
```

---

## 📋 Environment Variables Quick Reference

```env
# Required for all environments
NODE_ENV=development          # or 'production'
MONGODB_URI=mongodb://...
JWT_SECRET=your-secret-key

# Server configuration
PORT=5000
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

# Optional (have defaults)
JWT_EXPIRE=7d
MAX_FILE_SIZE=10485760       # 10MB
MAX_AVATAR_SIZE=2097152      # 2MB
```

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Set production `SERVER_URL` and `CLIENT_URL`
- [ ] Set production `MONGODB_URI`
- [ ] Generate secure random `JWT_SECRET` (e.g., `openssl rand -base64 32`)
- [ ] Configure CORS origins if different from `CLIENT_URL`
- [ ] Set appropriate `MAX_FILE_SIZE` and `MAX_AVATAR_SIZE`
- [ ] Ensure `/uploads` directory is accessible and has correct permissions
- [ ] Configure reverse proxy to serve static files from `/uploads`

---

## 🐛 Common Issues

### "MONGODB_URI must be set in production environment"
Set `MONGODB_URI` in your `.env` file when `NODE_ENV=production`.

### Avatar upload returns 400 "File too large"
Increase `MAX_AVATAR_SIZE` in `.env` (value in bytes).

### CORS errors in production
Add your production domain to `CORS_ORIGIN` in `.env`:
```env
CORS_ORIGIN=https://yourapp.com,https://www.yourapp.com
```

### Replies not showing up
Make sure you're passing the `replyTo` field when emitting `message:send` events.

---

## 📚 Additional Resources

- **Walkthrough Document**: See detailed explanation of all changes
- **Implementation Plan**: See architectural decisions
- **API Documentation**: Check route files for all endpoints
