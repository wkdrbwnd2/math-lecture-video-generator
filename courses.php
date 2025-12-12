<?php
// Dummy data for courses
$courses = [
    [
        'id' => 1,
        'title' => 'Introduction to AI in Simulation',
        'description' => 'Learn the fundamentals of integrating AI with complex simulation programs.',
        'image' => 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    ],
    [
        'id' => 2,
        'title' => 'Advanced Video Generation Techniques',
        'description' => 'Master the art of creating compelling educational videos with AI.',
        'image' => 'https://images.pexels.com/photos/5952239/pexels-photo-5952239.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    ],
    [
        'id' => 3,
        'title' => 'Model Context Protocol (MCP) in Practice',
        'description' => 'A deep dive into using MCP for dynamic script execution in videos.',
        'image' => 'https://images.pexels.com/photos/7688460/pexels-photo-7688460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    ],
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Courses - AI Video Platform</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/custom.css?v=<?php echo time(); ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">

    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div class="container-fluid">
            <a class="navbar-brand" href="index.php">AI Video Platform</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="index.php">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" aria-current="page" href="courses.php">Courses</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <main class="container my-5">
        <div class="text-center mb-5">
            <h1 class="fw-bold">Our Courses</h1>
            <p class="lead text-muted">Explore our catalog of AI-powered video courses.</p>
        </div>

        <div class="row g-4">
            <?php foreach ($courses as $course): ?>
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-sm course-card">
                    <img src="<?php echo htmlspecialchars($course['image']); ?>" class="card-img-top" alt="<?php echo htmlspecialchars($course['title']); ?>">
                    <div class="card-body">
                        <h5 class="card-title"><?php echo htmlspecialchars($course['title']); ?></h5>
                        <p class="card-text text-muted"><?php echo htmlspecialchars($course['description']); ?></p>
                    </div>
                    <div class="card-footer bg-white border-0">
                        <a href="video.php?id=<?php echo $course['id']; ?>" class="btn btn-primary w-100">View Course</a>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </main>

    <footer class="text-center py-4 text-muted border-top">
        &copy; <?php echo date("Y"); ?> AI Video Platform. All Rights Reserved.
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
