/**
 * routes/auth.routes.ts — rotas de autenticação (prefixo /api/auth).
 *
 *   POST /api/auth/register   criar conta        (corpo: name, identifier, password)
 *   POST /api/auth/login      iniciar sessão     (corpo: identifier, password, remember)
 *   POST /api/auth/google     entrar/registar com Google (corpo: accessToken)
 *   GET  /api/auth/me         utilizador atual   (requer sessão)
 *   PATCH /api/auth/me        editar perfil      (corpo: name?, email?, phone?) (requer sessão)
 *   POST /api/auth/change-password  alterar palavra-passe (corpo: currentPassword, newPassword) (requer sessão)
 *   POST /api/auth/forgot-password  pedir código de recuperação (corpo: identifier)
 *   POST /api/auth/reset-password   definir nova palavra-passe (corpo: identifier, code, newPassword)
 *   POST /api/auth/logout     terminar sessão
 */
import { Router } from "express";
import { authController, changePasswordSchema, forgotPasswordSchema, googleLoginSchema, loginSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, forgotLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, authLimiter, validateBody(registerSchema), authController.register);
authRouter.post("/login", authLimiter, validateBody(loginSchema), authController.login);
authRouter.post("/google", authLimiter, validateBody(googleLoginSchema), authController.googleLogin);
authRouter.get("/me", requireAuth, authController.me);
authRouter.patch("/me", requireAuth, validateBody(updateProfileSchema), authController.updateProfile);
// authLimiter: só conta tentativas falhadas, o que trava adivinhar a palavra-passe atual.
authRouter.post("/change-password", requireAuth, authLimiter, validateBody(changePasswordSchema), authController.changePassword);
authRouter.post("/logout", authController.logout);
// Recuperação: responde sempre 204 (não revela se a conta existe). O 2.º passo só conta falhas no limiter.
authRouter.post("/forgot-password", forgotLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRouter.post("/reset-password", authLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
