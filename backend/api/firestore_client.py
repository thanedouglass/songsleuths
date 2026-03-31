import firebase_admin
from firebase_admin import credentials, firestore
import os

def get_db():
    """Initializes Firebase Admin (if not already done) and returns the Firestore client."""
    if not firebase_admin._apps:
        cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
        if cred_path:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fall back to Application Default Credentials (for Cloud Run / GCP environments)
            firebase_admin.initialize_app()
    return firestore.client()

db = get_db()
