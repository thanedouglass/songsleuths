from api.scoring import calculate_puzzle_score, calculate_challenge_score

def test_solved_no_penalties():
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=0, hints_used=0) == 100

def test_solved_with_hint():
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=0, hints_used=1) == 75

def test_solved_with_incorrect_and_hint():
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=2, hints_used=1) == 55

def test_revealed_always_zero():
    assert calculate_puzzle_score(solved=False, revealed=True, incorrect_count=0, hints_used=0) == 0

def test_failed_no_reveal():
    assert calculate_puzzle_score(solved=False, revealed=False, incorrect_count=3, hints_used=0) == 0

def test_score_floor_is_zero():
    # Heavy penalties should never go negative
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=3, hints_used=10) == 0

def test_challenge_score_sums_puzzles():
    assert calculate_challenge_score([100, 75, 0, 50]) == 225
