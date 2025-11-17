import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { AuthService } from './services/auth.service';  // ADD THIS

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <router-outlet></router-outlet>
  `,
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  title = 'FileVerse';
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService  // ADD THIS
  ) {}

  ngOnInit() {
    // Check for OAuth callback with token from Google
    this.route.queryParams.subscribe(params => {
      if (params['token'] && params['user']) {
        const token = params['token'];
        const user = JSON.parse(decodeURIComponent(params['user']));
        
        // Store token and user in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // UPDATE: Notify AuthService to trigger navbar update
        this.authService.setCurrentUser(user);
        
        // Clean URL and redirect to dashboard
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      }
    });
  }
}