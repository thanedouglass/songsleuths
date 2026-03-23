from rest_framework import serializers

class CreateChallengeSerializer(serializers.Serializer):
    playlist_url = serializers.URLField()
    title        = serializers.CharField(max_length=100)
    description  = serializers.CharField(max_length=500, required=False, allow_blank=True)
    privacy      = serializers.ChoiceField(choices=['public', 'private', 'restricted'])
    allowed_uids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

class PlaylistPreviewSerializer(serializers.Serializer):
    playlist_url = serializers.URLField()

class PuzzleResultSerializer(serializers.Serializer):
    song_index      = serializers.IntegerField(min_value=0)
    solved          = serializers.BooleanField()
    revealed        = serializers.BooleanField()
    incorrect_count = serializers.IntegerField(min_value=0, max_value=3)
    hints_used      = serializers.IntegerField(min_value=0)

class ScoreSubmitSerializer(serializers.Serializer):
    challenge_id             = serializers.CharField()
    puzzle_results           = PuzzleResultSerializer(many=True)
    completion_time_seconds  = serializers.IntegerField(min_value=0)
