
const express = require("express");
const mongoose = require("mongoose");

const app = express();
const port = 4555;

app.use(express.json());

// Database Connection
const databaseConnection = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/techSchoolApp");
    console.log("Database connected successfully");
  } catch (error) {
    console.log("Database connection failed", error);
  }
};

databaseConnection();

// Home Route
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Student Schema
const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  age: Number,
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: String,
  address: String,
  course: {
    type: String,
    minlength: 2,
  },
  institution: String,
});

const Student = mongoose.model("Student", studentSchema);

// Create Student
app.post("/create-student", async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();

    return res.status(201).json({
      message: "Student created successfully",
      student,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get All Students
app.get("/get-students", async (req, res) => {
  try {
    const students = await Student.find();

    return res.status(200).json({
      message: "Students fetched successfully",
      students,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get Student By ID
app.get("/get-student/:id", async (req, res) => {
  const { id } = req.params;

  // Checks only the ID format.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID",
    });
  }

  try {
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student fetched successfully",
      student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Update Student
app.put("/update-student/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID",
    });
  }

  try {
    const student = await Student.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student updated successfully",
      student,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get Student By Name
app.get("/get-student-by-name", async (req, res) => {
  const { name } = req.query;

  try {
    const student = await Student.find({ name });

    return res.status(200).json({
      message: "Student fetched successfully",
      student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Search Students
app.get("/search-students", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({
      message: "Search query is required",
    });
  }

  try {
    const students = await Student.find({
      $or: [
        { name: { $regex: q.trim(), $options: "i" } },
        { email: { $regex: q.trim(), $options: "i" } },
        { course: { $regex: q.trim(), $options: "i" } },
      ],
    });

    return res.status(200).json(students);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Update Course Only
app.patch("/students/:id/course", async (req, res) => {
  const { id } = req.params;
  const { course } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID",
    });
  }

  if (!course || course.trim() === "") {
    return res.status(400).json({
      message: "Course is required",
    });
  }

  try {
    const student = await Student.findByIdAndUpdate(
      id,
      { course: course.trim() },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Course updated successfully",
      student,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Delete Student
app.delete("/delete-student/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid student ID",
    });
  }

  try {
    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student deleted successfully",
      student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});