export interface RegisterDto {
  name: string;
  email: string;
  address: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
  currentCookieToken: string;
}

export interface UpdatePasswordDto {
  password: string;
  userId: string;
}
