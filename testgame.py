import pygame
import numpy as np
import sys

# Initialize pygame
pygame.init()
pygame.mixer.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Bounce Ball Game")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
BLUE = (0, 0, 255)
GREEN = (0, 255, 0)
GRAY = (100, 100, 100)

# Game states
MENU = 0
PLAYING = 1
GAME_OVER = 2
game_state = MENU

# Ball properties
ball_size = 40  # Side length of the square ball
ball_pos = np.array([WIDTH // 2, HEIGHT // 2], dtype=np.float64)
ball_vel = np.array([5, 5], dtype=np.float64)
TIME_STEP = 1

# Paddle properties
paddle_width = 100
paddle_height = 20
paddle_x = (WIDTH - paddle_width) // 2
paddle_y = HEIGHT - 50
paddle_speed = 10

# Game properties
score = 0
lives = 3
font = pygame.font.Font(None, 36)

# Clock to control the frame rate
clock = pygame.time.Clock()

def reset_game():
    global ball_pos, ball_vel, paddle_x, score, lives, game_state
    ball_pos = np.array([WIDTH // 2, HEIGHT // 2], dtype=np.float64)
    ball_vel = np.array([5, 5], dtype=np.float64)
    paddle_x = (WIDTH - paddle_width) // 2
    score = 0
    lives = 3
    game_state = PLAYING

def update_ball_position(ball_pos, ball_vel):
    global score
    # Update ball position
    ball_pos += ball_vel * TIME_STEP

    # Ball collision with walls
    if ball_pos[0] - ball_size/2 < 0 or ball_pos[0] + ball_size/2 > WIDTH:
        ball_vel[0] *= -1
        score += 1
    if ball_pos[1] - ball_size/2 < 0:
        ball_vel[1] *= -1
        score += 1

    # Ball collision with paddle
    if (
        paddle_x < ball_pos[0] < paddle_x + paddle_width
        and paddle_y < ball_pos[1] + ball_size/2 < paddle_y + paddle_height
    ):
        ball_vel[1] *= -1
        score += 5

    return ball_pos, ball_vel

def draw_menu():
    screen.fill(BLACK)
    title = font.render("Bounce Ball Game", True, WHITE)
    start_text = font.render("Press SPACE to Start", True, WHITE)
    screen.blit(title, (WIDTH//2 - title.get_width()//2, HEIGHT//3))
    screen.blit(start_text, (WIDTH//2 - start_text.get_width()//2, HEIGHT//2))

def draw_game_over():
    screen.fill(BLACK)
    game_over = font.render("Game Over!", True, RED)
    final_score = font.render(f"Final Score: {score}", True, WHITE)
    restart_text = font.render("Press R to Restart", True, WHITE)
    screen.blit(game_over, (WIDTH//2 - game_over.get_width()//2, HEIGHT//3))
    screen.blit(final_score, (WIDTH//2 - final_score.get_width()//2, HEIGHT//2))
    screen.blit(restart_text, (WIDTH//2 - restart_text.get_width()//2, HEIGHT*2//3))

def draw_zigzag_paddle(screen, x, y, width, height, color, segment_width=20):
    """Draws a zig-zag shaped paddle."""
    num_segments = width // segment_width
    points = []
    for i in range(num_segments + 1):
        x_pos = x + i * segment_width
        y_pos = y
        if i % 2 != 0:
            y_pos -= height // 2  # Move up for odd segments
        else:
             y_pos += height // 2
        points.append((x_pos, y_pos))

    # Connect the points to create the zig-zag shape
    pygame.draw.lines(screen, color, False, points, width=5)

def main():
    global paddle_x, ball_pos, ball_vel, game_state, lives, score

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE and game_state == MENU:
                    reset_game()
                if event.key == pygame.K_r and game_state == GAME_OVER:
                    reset_game()

        if game_state == PLAYING:
            # Move the paddle
            keys = pygame.key.get_pressed()
            if keys[pygame.K_LEFT] and paddle_x > 0:
                paddle_x -= paddle_speed
            if keys[pygame.K_RIGHT] and paddle_x < WIDTH - paddle_width:
                paddle_x += paddle_speed

            # Update ball position
            ball_pos, ball_vel = update_ball_position(ball_pos, ball_vel)

            # Game over if ball falls off the bottom
            if ball_pos[1] + ball_size/2 > HEIGHT:
                lives -= 1
                if lives <= 0:
                    game_state = GAME_OVER
                else:
                    ball_pos = np.array([WIDTH // 2, HEIGHT // 2], dtype=np.float64)
                    ball_vel = np.array([5, 5], dtype=np.float64)

            # Clear the screen
            screen.fill(BLACK)

            # Draw the ball
            pygame.draw.rect(screen, RED, (ball_pos[0] - ball_size/2, ball_pos[1] - ball_size/2, ball_size, ball_size))

            # Draw the paddle
            #pygame.draw.rect(screen, WHITE, (paddle_x, paddle_y, paddle_width, paddle_height))
            draw_zigzag_paddle(screen, paddle_x, paddle_y, paddle_width, paddle_height, WHITE)

            # Draw score and lives
            score_text = font.render(f"Score: {score}", True, WHITE)
            lives_text = font.render(f"Lives: {lives}", True, WHITE)
            screen.blit(score_text, (10, 10))
            screen.blit(lives_text, (WIDTH - lives_text.get_width() - 10, 10))

        elif game_state == MENU:
            draw_menu()
        elif game_state == GAME_OVER:
            draw_game_over()

        # Update the display
        pygame.display.flip()

        # Control the frame rate
        clock.tick(60)

    # Quit pygame
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()