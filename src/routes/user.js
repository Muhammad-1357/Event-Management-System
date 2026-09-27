const express = require("express");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/profile", requireAuth, (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      isVerified: req.user.isVerified,
      createdAt: req.user.createdAt,
    },
  });
});

module.exports = router;