from django.urls import path
from . import views

urlpatterns = [
    # Challenges
    path('challenges/',           views.ChallengeListCreateView.as_view()),
    path('challenges/<str:pk>/',  views.ChallengeDetailView.as_view()),

    # Spotify proxy
    path('spotify/playlist/',     views.SpotifyPlaylistView.as_view()),
    path('spotify/preview/<str:track_id>/', views.SpotifyPreviewView.as_view()),

    # Scores
    path('scores/',               views.ScoreSubmitView.as_view()),
    path('leaderboard/<str:challenge_id>/', views.LeaderboardView.as_view()),
]
