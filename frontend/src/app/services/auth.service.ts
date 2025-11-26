// frontend/src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  requiresVerification?: boolean;
}

interface MessageResponse {
  success: boolean;
  message: string;
  requiresVerification?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load user from localStorage on initialization
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  register(username: string, email: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/register`, {
      username, 
      email, 
      password
    });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, {
      email, 
      password
    }).pipe(
      tap((response: AuthResponse) => {
        // Only store token/user if email is verified (no requiresVerification flag)
        if (response.token && response.user && !response.requiresVerification) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  verifyEmail(token: string): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.apiUrl}/auth/verify-email/${token}`).pipe(
      tap((response: AuthResponse) => {
        if (response.token && response.user) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  validateResetToken(token: string): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(`${this.apiUrl}/auth/validate-reset-token/${token}`);
  }

  resetPassword(token: string, password: string): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${this.apiUrl}/auth/reset-password/${token}`, {
      password
    }).pipe(
      tap((response: AuthResponse) => {
        if (response.token && response.user) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
    );
  }

  setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}