import { z } from 'zod';

// Shared base fields
const baseAuthSchema = {
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().length(11, 'Phone number must be exactly 11 digits').regex(/^\d+$/, 'Digits only'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  address: z.string().min(5, 'Please enter a valid residential address'),
  age: z.string().refine((val) => {
    const age = parseInt(val, 10);
    return !isNaN(age) && age >= 18;
  }, { message: 'Minimum age is 18' }),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'Please select a gender' }),
  nationality: z.string().min(2, 'Nationality is required'),
};

export const DriverSignUpSchema = z.object({
  ...baseAuthSchema,
  role: z.literal('DRIVER'),
  nin: z.string().length(11, 'NIN must be exactly 11 digits').regex(/^\d+$/, 'Digits only'),
  transmission: z.enum(['Manual', 'Automatic', 'Both'], { message: 'Select a transmission type' }),
  licenseImage: z.string().min(1, 'Driver license photo is required'),
  selfieImage: z.string().min(1, 'Verification selfie is required'),
  ninImage: z.string().min(1, 'NIN card photo is required'),
  bankCode: z.string().min(1, 'Please select your bank'),
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  accountName: z.string().min(2, 'Account name is required'),
  backgroundCheckAccepted: z.literal(true, {
    message: 'You must accept the background check',
  }),
});

export const OwnerSignUpSchema = z.object({
  ...baseAuthSchema,
  role: z.literal('OWNER'),
  carType: z.enum(['Standard', 'Executive', 'Luxury', 'SUV'], { message: 'Select a car category' }),
  carModel: z.string().min(2, 'Car model is required'),
  carYear: z.string().refine((val) => {
    const year = parseInt(val, 10);
    const currentYear = new Date().getFullYear();
    return !isNaN(year) && year >= 1990 && year <= currentYear + 1;
  }, { message: 'Invalid vehicle year' }),
  transmission: z.enum(['Manual', 'Automatic'], { message: 'Select a transmission' }),
  backgroundCheckAccepted: z.literal(true, {
    message: "You must agree to the Terms of Service",
  }),
});

export type DriverSignUpData = z.infer<typeof DriverSignUpSchema>;
export type OwnerSignUpData = z.infer<typeof OwnerSignUpSchema>;
