import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { JWT_SECRET, route } from "../auth.js";


export const login = route({ auth: false }, (req, res) => {
  const { employeeId, password } = req.body || {};
  if (!employeeId || !password) {
    return res.status(400).json({ error: "Employee ID and password are required" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE employee_id = ?")
    .get(employeeId.trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid employee ID or password" });
  }

  // The gate-out step (and its Security role) was removed; old Security
  // accounts stay in the DB only because past status history references them.
  if (user.role === "security") {
    return res.status(403).json({ error: "Security logins are no longer used — gate-out has been removed." });
  }

  const token = jwt.sign(
    { id: user.id, employeeId: user.employee_id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    user: { id: user.id, employeeId: user.employee_id, name: user.name, role: user.role },
  });
});

