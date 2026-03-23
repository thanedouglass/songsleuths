import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import os

# Initialize Firebase Admin SDK once
_cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
if _cred_path and not firebase_admin._apps:
    try:
        cred = credentials.Certificate(_cred_path)
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Warning: Could not initialize Firebase Admin SDK: {e}")

class FirebaseAuthentication(BaseAuthentication):
    """
    Verifies the Firebase ID token passed in the Authorization: Bearer <token> header.
    Returns (uid_string, None) on success or raises AuthenticationFailed.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        id_token = auth_header.split('Bearer ')[1]
        try:
            decoded = firebase_auth.verify_id_token(id_token)
            return (decoded['uid'], None)
        except Exception:
            raise AuthenticationFailed('Invalid or expired Firebase token.')
