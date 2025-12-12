<?php
session_start();

require_once __DIR__ . '/ai/LocalAIApi.php';

$aiReply = '';
$prompt = '';

if (!isset($_SESSION['chat_history'])) {
    $_SESSION['chat_history'] = [];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['prompt'])) {
    $prompt = $_POST['prompt'];

    // Add user message to history
    $_SESSION['chat_history'][] = ['role' => 'user', 'content' => $prompt];

    $resp = LocalAIApi::createResponse([
        'input' => [
            [
                'role' => 'system',
                'content' => 'You are an AI assistant helping a user create a video. Your goal is to evaluate the user\'s prompt and ask for missing details or suggest improvements. Be conversational and helpful. Ask questions to refine the prompt for video generation. You must ask at least one question.'
            ],
            [
                'role' => 'user',
                'content' => $prompt
            ],
        ],
    ]);

    if (!empty($resp['success'])) {
        $text = LocalAIApi::extractText($resp);
        if ($text === '') {
            $decoded = LocalAIApi::decodeJsonFromResponse($resp);
            $text = $decoded ? json_encode($decoded, JSON_UNESCAPED_UNICODE) : (string)($resp['data'] ?? '');
        }
        $aiReply = $text;
        // Add AI message to history
        $_SESSION['chat_history'][] = ['role' => 'assistant', 'content' => $aiReply];
    } else {
        $error = $resp['error'] ?? 'Unknown error';
        $aiReply = 'Sorry, I encountered an error: ' . $error;
        $_SESSION['chat_history'][] = ['role' => 'assistant', 'content' => $aiReply];
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Submission - AI Video Platform</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/custom.css?v=<?php echo time(); ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">

    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div class="container-fluid">
            <a class="navbar-brand" href="/">AI Video Platform</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/courses">Courses</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" aria-current="page" href="/prompt">Prompt</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <main class="container my-5">
        <div class="text-center mb-5">
            <h1 class="fw-bold">Create a New Video</h1>
            <p class="lead text-muted">Describe the educational video you want to create.</p>
        </div>

        <div class="row">
            <div class="col-md-8 mx-auto">
                <div class="card shadow-sm">
                    <div class="card-body p-4">
                        <div id="chat-window" class="mb-3 p-3 bg-light" style="height: 400px; overflow-y: scroll; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                            <?php if (empty($_SESSION['chat_history'])): ?>
                                <div class="text-center text-muted mt-5">Start the conversation by typing your prompt below.</div>
                            <?php endif; ?>
                            <?php foreach ($_SESSION['chat_history'] as $message): ?>
                                <div class="message mb-3 <?php echo $message['role'] === 'user' ? 'user-message' : 'assistant-message'; ?>">
                                    <div class="bubble">
                                        <?php echo nl2br(htmlspecialchars($message['content'])); ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>

                        <form method="POST" action="/prompt">
                            <div class="mb-3">
                                <label for="prompt" class="form-label">Your Prompt</label>
                                <textarea class="form-control" id="prompt" name="prompt" rows="3" required></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Send</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer class="text-center py-4 text-muted border-top mt-5">
        &copy; <?php echo date("Y"); ?> AI Video Platform. All Rights Reserved.
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Scroll chat window to the bottom
        const chatWindow = document.getElementById('chat-window');
        chatWindow.scrollTop = chatWindow.scrollHeight;
    </script>
</body>
</html>
