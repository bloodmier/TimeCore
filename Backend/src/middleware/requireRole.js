/**
 * Role-based authorization middleware.
 *
 * Must be used AFTER requireAuth.
 *
 * Usage:
 *   router.post("/admin", requireAuth, requireRole("admin"), handler);
 *   router.get("/staff", requireAuth, requireRole(["admin", "staff"]), handler);
 */

export function requireRole(required) {
  const requiredRoles = Array.isArray(required)
    ? required.map(r => String(r).toLowerCase())
    : [String(required).toLowerCase()];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userRole = String(req.user.role || "").toLowerCase();

    if (!requiredRoles.includes(userRole)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action"
      });
    }

    return next();
  };
}
