from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class ChallengeListCreateView(APIView):
    def get(self, request):
        return Response({'message': 'ChallengeListCreate — stub'})
    def post(self, request):
        return Response({'message': 'ChallengeListCreate — stub'}, status=status.HTTP_201_CREATED)

class ChallengeDetailView(APIView):
    def get(self, request, pk):
        return Response({'message': 'ChallengeDetailView — stub'})

class SpotifyPlaylistView(APIView):
    def get(self, request):
        return Response({'message': 'SpotifyPlaylistView — stub'})

class SpotifyPreviewView(APIView):
    def get(self, request, track_id):
        return Response({'message': 'SpotifyPreviewView — stub'})

class ScoreSubmitView(APIView):
    def post(self, request):
        return Response({'message': 'ScoreSubmitView — stub'}, status=status.HTTP_201_CREATED)

class LeaderboardView(APIView):
    def get(self, request, challenge_id):
        return Response({'message': 'LeaderboardView — stub'})
