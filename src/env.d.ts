/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    associationInfo?: Promise<import('./content/types').AssociationInfo | null>;
  }
}
