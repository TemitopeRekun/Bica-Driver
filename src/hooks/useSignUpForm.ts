import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/services/api.service';
import { mapUser } from '@/mappers/appMappers';
import { AuthResponse, UserRole } from '@/types';
import { DriverSignUpSchema, OwnerSignUpSchema } from '@/schemas/authSchemas';
import { ZodError } from 'zod';

export const useSignUpForm = (initialRole: UserRole) => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { addToast } = useUIStore();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    role: initialRole,
    nationality: 'Nigerian',
    transmission: 'Automatic',
    backgroundCheckAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDriver = initialRole === UserRole.DRIVER;
  const totalSteps = isDriver ? 4 : 3;

  const validateStep = useCallback(() => {
    const schema = isDriver ? DriverSignUpSchema : OwnerSignUpSchema;
    
    // Mapping of which fields to validate per step
    const stepFields: Record<number, string[]> = {
      1: ['name', 'email', 'phone', 'age', 'gender', 'nationality', 'address'],
      2: isDriver ? ['nin', 'transmission', 'licenseImage', 'selfieImage', 'ninImage'] : ['carType', 'carModel', 'carYear', 'transmission'],
      3: isDriver ? ['bankCode', 'accountNumber', 'accountName'] : ['password', 'backgroundCheckAccepted'],
      4: ['password', 'backgroundCheckAccepted'],
    };

    const currentFields = stepFields[step];
    const newErrors: Record<string, string> = {};
    let isValid = true;

    try {
      // Pick only the fields for the current step to validate
      const stepSchema = (schema as any).pick(currentFields.reduce((acc: any, f) => ({ ...acc, [f]: true }), {}));
      stepSchema.parse(formData);
      setErrors({});
    } catch (err) {
      if (err instanceof ZodError) {
        err.issues.forEach((e) => {
          if (e.path[0]) newErrors[e.path[0] as string] = e.message;
        });
        setErrors(newErrors);
        isValid = false;
      }
    }

    return isValid;
  }, [formData, isDriver, step]);

  const handleNext = useCallback(() => {
    if (validateStep()) {
      setStep((prev) => Math.min(prev + 1, totalSteps));
    } else {
      addToast('Please correct the errors before proceeding.', 'warning');
    }
  }, [validateStep, totalSteps, addToast]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    } else {
      navigate('/role-selection');
    }
  }, [step, navigate]);

  const updateField = useCallback((field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const submit = async () => {
    if (!validateStep()) return;

    setIsLoading(true);
    try {
      // Transform data for API to match backend contract exactly
      // 🛡️ We destructure to pull out UI-specific names and avoid "extra field" errors (400)
      const { 
        licenseImage, selfieImage, ninImage, 
        carType, carModel, carYear,
        ...rest 
      } = formData;

      const basePayload = {
        ...rest,
        gender: formData.gender?.toUpperCase(),
        transmission: formData.transmission?.toUpperCase(),
      };

      let finalPayload: any;

      if (isDriver) {
        finalPayload = {
          ...basePayload,
          licenseImageUrl: licenseImage,
          selfieImageUrl: selfieImage,
          ninImageUrl: ninImage,
        };
      } else {
        finalPayload = {
          ...basePayload,
          carType: carType?.toUpperCase(),
          carModel,
          carYear,
        };
      }

      const response = await api.post<AuthResponse>('/auth/register', finalPayload, false);

      if (response.token) {
        const mapped = mapUser(response.user);
        await login(mapped, response.token);
        addToast(`Welcome to BICA, ${mapped.name}!`, 'success');
        navigate(mapped.role === UserRole.DRIVER ? '/driver' : '/owner');
      } else {
        addToast(response.message || 'Registration successful! Please log in.', 'info');
        navigate('/login');
      }
    } catch (error: any) {
       // Global error handler handles toasts
    } finally {
      setIsLoading(false);
    }
  };

  return {
    step,
    totalSteps,
    formData,
    errors,
    isLoading,
    updateField,
    handleNext,
    handleBack,
    submit,
    isDriver,
  };
};
