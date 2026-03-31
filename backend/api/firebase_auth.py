import os
import requests
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

class FirebaseAuthenticated(BaseAuthentication):
    """
    Reads Authorization: Bearer <firebase_id_token>
    Verifies it using Google Identity Toolkit API.
    Returns (user_data, None) on success.
    Raises AuthenticationFailed if invalid.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
            
        id_token = auth_header.split('Bearer ', 1)[1].strip()
        project_id = os.getenv('FIREBASE_PROJECT_ID')
        api_key = os.getenv('FIREBASE_API_KEY') # Usually needed for this endpoint but we will use the generic approach if not provided
        
        # Google Identity Toolkit API
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}"
        
        payload = {"idToken": id_token}
        try:
            response = requests.post(url, json=payload)
            data = response.json()
            if 'error' in data:
                raise AuthenticationFailed(f"Firebase auth failed: {data['error'].get('message')}")
                
            users = data.get('users', [])
            if not users:
                raise AuthenticationFailed("No user found for this token.")
                
            user = users[0]
            # Returning uid and email (or just dictionary)
            return (user.get('localId'), None)
        except requests.RequestException as e:
            raise AuthenticationFailed(f"Error contacting Firebase: {str(e)}")
