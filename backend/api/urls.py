from django.urls import path
from . import views

urlpatterns = [
    # Health check
    path('health/',                                             views.HealthCheckView.as_view()),

    # Challenges — list/create + detail/delete
    path('challenges/',                                         views.ChallengeListCreateView.as_view()),
    path('challenges/<str:pk>/',                                views.ChallengeDetailView.as_view()),

    # Gameplay endpoints (M3)
    path('challenges/<str:pk>/songs/<int:song_index>/puzzle/',  views.SongPuzzleView.as_view()),
    path('challenges/<str:pk>/songs/<int:song_index>/guess/',   views.SongGuessView.as_view()),
    path('challenges/<str:pk>/songs/<int:song_index>/answer/',  views.SongAnswerView.as_view()),
    path('challenges/<str:pk>/scores/',                         views.ChallengeScoreView.as_view()),

    # Explore (public feed sorted by playCount)
    path('explore/',                                            views.ExploreView.as_view()),

    # Spotify proxy (M1)
    path('spotify/playlist/',                                   views.SpotifyPlaylistView.as_view()),
    path('spotify/preview/<str:track_id>/',                     views.SpotifyPreviewView.as_view()),

    # Scores & leaderboard (M1)
    path('scores/',                                             views.ScoreSubmitView.as_view()),
    path('leaderboard/<str:challenge_id>/',                     views.LeaderboardView.as_view()),
]
