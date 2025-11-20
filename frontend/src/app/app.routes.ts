import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { DashboardComponent } from './components/dashboard/dashboard';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password';
import { ResetPasswordComponent } from './components/reset-password/reset-password';
import { VerifyEmailComponent } from './components/verify-email/verify-email';
import { ResendVerificationComponent } from './components/resend-verification/resend-verification';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },
  { path: 'resend-verification', component: ResendVerificationComponent }
];