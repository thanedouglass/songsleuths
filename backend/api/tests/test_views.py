import pytest
from django.test import Client

@pytest.mark.django_db
def test_challenges_endpoint_returns_200():
    client = Client()
    response = client.get('/api/challenges/')
    assert response.status_code == 200
