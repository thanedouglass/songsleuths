BASE_SCORE          = 100   # points for solving a puzzle
HINT_PENALTY        = 25    # deducted per audio hint used
INCORRECT_PENALTY   = 10    # deducted per wrong letter guess
REVEAL_SCORE        = 0     # always 0 if answer was revealed

def calculate_puzzle_score(
    solved: bool,
    revealed: bool,
    incorrect_count: int,
    hints_used: int,
) -> int:
    """
    Returns the score for a single puzzle (one song).
    
    Rules:
    - If revealed: always 0
    - If not solved and not revealed: 0 (ran out of attempts)
    - If solved: BASE_SCORE minus penalties, floor of 0
    """
    if revealed:
        return REVEAL_SCORE
    if not solved:
        return 0
        
    penalties = (hints_used * HINT_PENALTY) + (incorrect_count * INCORRECT_PENALTY)
    score = BASE_SCORE - penalties
    return max(0, score)

def calculate_challenge_score(puzzle_scores: list[int]) -> int:
    """
    Sums puzzle scores across all songs in a challenge.
    """
    return sum(puzzle_scores)
