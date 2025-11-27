// frontend/src/app/components/export/export.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './export.html',
  styleUrls: ['./export.css']
})
export class ExportComponent {
  constructor() {}
}