import firebase_admin
from firebase_admin import firestore
import os
import api.firebase_auth  # Import to ensure Firebase Admin is initialized

# Firebase Admin is already initialized in firebase_auth.py
# This module just exposes the Firestore client.

def get_db():
    """Returns the Firestore client. Safe to call multiple times."""
    return firestore.client()

db = get_db()
