import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/services/api.service';
import { mapUser } from '@/mappers/appMappers';
import { AuthResponse, UserRole, UserProfile } from '@/types';
import { CapacitorService } from '@/services/CapacitorService';
import { CameraSource } from '@capacitor/camera';

const SignUpScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { addToast } = useUIStore();
  
  // Role lock from previous step
  const initialRole = (location.state as any)?.role || UserRole.OWNER;
  const [role] = useState<UserRole>(initialRole);
  const isDriver = role === UserRole.DRIVER;
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<UserProfile & { password?: string }>({
    id: '',
    role: initialRole,
    name: '',
    email: '',
    phone: '',
    password: '',
    age: '',
    gender: '',
    nationality: 'Nigerian',
    address: '',
    nin: '',
    carType: '',
    carModel: '',
    carYear: '',
    transmission: 'Automatic',
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
    licenseImage: '',
    selfieImage: '',
    ninImage: '',
    backgroundCheckAccepted: false,
    rating: 5,
    trips: 0,
    avatar: '',
  });

  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [isCapturing, setIsCapturing] = useState<'license' | 'selfie' | 'nin' | null>(null);
  const [showSourceSelector, setShowSourceSelector] = useState<'license' | 'selfie' | 'nin' | null>(null);

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const totalSteps = isDriver ? 4 : 3;

  // Effects
  useEffect(() => {
    if (isDriver) {
      api.get<{ name: string; code: string }[]>('/payments/banks', false)
        .then(setBanks)
        .catch(() => addToast("We couldn't load the bank list. Please check your connection.", "warning"));
    }
  }, [isDriver, addToast]);

  // Helpers
  const filterDigits = (val: string) => (val || '').replace(/\D/g, '');

  const validateField = (name: string, value: any): string => {
    const trimmedVal = typeof value === 'string' ? value.trim() : value;

    switch (name) {
      case 'name':
        if (!trimmedVal) return 'Full name is required';
        if (trimmedVal.length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'email':
        if (!trimmedVal) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedVal)) return 'Enter a valid email address';
        return '';
      case 'phone':
        const digits = filterDigits(value);
        if (!digits) return 'Phone number is required';
        if (digits.length !== 11) return 'Phone number must be exactly 11 digits';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'At least 6 characters required';
        return '';
      case 'age':
        if (!value) return 'Age is required';
        const ageNum = parseInt(value, 10);
        if (isNaN(ageNum) || ageNum < 18) return 'Minimum age is 18';
        return '';
      case 'address':
        if (!trimmedVal) return 'Residential address is required';
        return '';
      case 'nin':
        if (isDriver) {
          const ninDigits = filterDigits(value);
          if (!ninDigits) return 'NIN is required';
          if (ninDigits.length !== 11) return 'NIN must be 11 digits';
        }
        return '';
      case 'bankCode':
        if (isDriver && !value) return 'Please select your bank';
        return '';
      case 'accountNumber':
        if (isDriver) {
          const accDigits = filterDigits(value);
          if (!accDigits) return 'Required';
          if (accDigits.length !== 10) return 'Must be 10 digits';
        }
        return '';
      case 'accountName':
        if (isDriver && !trimmedVal) return 'Required for payments';
        return '';
      case 'carType':
        if (!isDriver && !trimmedVal) return 'Vehicle type required';
        return '';
      case 'carModel':
        if (!isDriver && !trimmedVal) return 'Model is required';
        return '';
      case 'carYear':
        if (!isDriver) {
          const yearDigits = filterDigits(value);
          if (!yearDigits) return 'Year required';
          if (yearDigits.length !== 4) return 'Enter 4 digits';
          const yearNum = parseInt(yearDigits, 10);
          const currentYear = new Date().getFullYear();
          if (yearNum < 1990 || yearNum > currentYear + 1) return 'Unrecognized year';
        }
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, (formData as any)[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleNext = () => {
    // Validate current step fields
    const stepFields: Record<number, string[]> = {
      1: ['name', 'email', 'phone', 'age', 'gender', 'nationality', 'address'],
      2: isDriver ? ['nin'] : ['carType', 'carModel', 'carYear', 'transmission'],
      3: isDriver ? ['bankCode', 'accountNumber', 'accountName'] : ['password'],
      4: ['password']
    };

    const currentFields = stepFields[step];
    const newErrors: Record<string, string> = {};
    let hasError = false;

    currentFields.forEach(f => {
      const err = validateField(f, (formData as any)[f]);
      if (err) {
        newErrors[f] = err;
        hasError = true;
      }
    });

    // Special Image validation for Driver Step 2
    if (step === 2 && isDriver) {
      if (!formData.licenseImage || !formData.selfieImage || !formData.ninImage) {
        addToast("Please upload your license, selfie, and NIN card images.", "warning");
        return;
      }
    }

    if (hasError) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      setTouched(prev => {
        const next = { ...prev };
        currentFields.forEach(f => next[f] = true);
        return next;
      });
      addToast("Please correct the fields before proceeding.", "warning");
      return;
    }

    CapacitorService.triggerHaptic();
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    CapacitorService.triggerHaptic();
    if (step > 1) {
      setStep(prev => prev - 1);
    } else {
      navigate('/role-selection');
    }
  };

  const handleCapture = async (type: 'license' | 'selfie' | 'nin', source: CameraSource) => {
    setShowSourceSelector(null);
    setIsCapturing(type);
    try {
      const photo = await CapacitorService.takePhoto(source);
      if (photo) {
        setFormData(prev => ({ ...prev, [`${type}Image`]: photo }));
      }
    } finally {
      setIsCapturing(null);
    }
  };

  const handleSubmit = async () => {
    if (isDriver && !formData.backgroundCheckAccepted) {
      addToast('Please accept the background check to continue.', 'warning');
      return;
    }

    const passError = validateField('password', formData.password);
    if (passError) {
      setErrors(prev => ({ ...prev, password: passError }));
      setTouched(prev => ({ ...prev, password: true }));
      addToast(passError, 'warning');
      return;
    }

    setIsLoading(true);
    try {
      // Create a clean, role-aware payload strictly following the Bica API Contract
      const basePayload: any = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      };

      let finalPayload: any = {};

      if (isDriver) {
        // Driver Specific Fields (Strictly following the contract)
        finalPayload = {
          ...basePayload,
          nin: formData.nin,
          transmission: formData.transmission.toUpperCase(),
          licenseImageUrl: formData.licenseImage, // Base64 as per contract
          ninImageUrl: formData.ninImage,         // Base64 as per contract
          selfieImageUrl: formData.selfieImage,   // Base64 as per contract
          bankName: formData.bankName,
          bankCode: formData.bankCode,
          accountNumber: formData.accountNumber,
          accountName: formData.accountName.trim(),
          backgroundCheckAccepted: formData.backgroundCheckAccepted,
        };
      } else {
        // Owner Specific Fields (Strictly following the contract)
        finalPayload = {
          ...basePayload,
          carType: formData.carType.toUpperCase(), // Normalize for contract safety
          carModel: formData.carModel.trim(),
          carYear: formData.carYear,
          gender: formData.gender.toUpperCase(),
          address: formData.address.trim(),
          nationality: formData.nationality.trim(),
          age: String(formData.age),
        };
      }

      const response = await api.post<AuthResponse>('/auth/register', finalPayload, false);

      if (response.token) {
        const mapped = mapUser(response.user);
        await login(mapped, response.token);
        addToast(`Welcome to BICA, ${mapped.name}! Your account is ready.`, 'success');
        navigate(mapped.role === UserRole.DRIVER ? '/driver' : '/owner');
      } else {
        addToast(response.message || 'Registration submitted! Please wait for admin approval.', 'info');
        navigate('/login');
      }
    } catch (error: any) {
       // Handled by global interceptor, but we catch to stop loading
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-100 dark:border-white/5">
        <button 
          onClick={handleBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <div className="flex flex-col items-center">
            <h1 className="text-sm font-bold leading-tight">Registration</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Step {step} of {totalSteps}</p>
        </div>
        <div className="size-10 flex items-center justify-center">
             <span className="text-xs font-bold text-primary">{Math.round((step/totalSteps)*100)}%</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-6 pb-8 w-full overflow-y-auto no-scrollbar">
          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full mb-8 overflow-hidden">
             <div 
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${(step/totalSteps)*100}%` }}
             />
          </div>

          {/* STEP 1: PERSONAL PROFILE */}
          {step === 1 && (
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold mb-1">Personal Profile</h2>
                    <p className="text-sm text-slate-500 font-medium">This information helps us verify your identity.</p>
                </div>
                
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Full Name</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.name && touched.name ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">person</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={e => {
                                setFormData({...formData, name: e.target.value});
                                setErrors(prev => ({...prev, name: ''}));
                            }}
                            onBlur={() => handleBlur('name')}
                        />
                    </div>
                    {errors.name && touched.name && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.name}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Email Address</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.email && touched.email ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">mail</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                            placeholder="john@example.com"
                            type="email"
                            value={formData.email}
                            onChange={e => {
                                setFormData({...formData, email: e.target.value});
                                setErrors(prev => ({...prev, email: ''}));
                            }}
                            onBlur={() => handleBlur('email')}
                        />
                    </div>
                    {errors.email && touched.email && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.email}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Phone Number</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.phone && touched.phone ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">phone_iphone</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                            placeholder="08012345678"
                            type="tel"
                            value={formData.phone}
                            onChange={e => {
                                const val = filterDigits(e.target.value).slice(0, 11);
                                setFormData({...formData, phone: val});
                                setErrors(prev => ({...prev, phone: ''}));
                            }}
                            onBlur={() => handleBlur('phone')}
                        />
                    </div>
                    {errors.phone && touched.phone && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.phone}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Age</label>
                        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.age && touched.age ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                            <input 
                                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0 text-center"
                                placeholder="18+"
                                type="number"
                                value={formData.age}
                                onChange={e => {
                                    setFormData({...formData, age: e.target.value});
                                    setErrors(prev => ({...prev, age: ''}));
                                }}
                                onBlur={() => handleBlur('age')}
                            />
                        </div>
                        {errors.age && touched.age && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.age}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.gender && touched.gender ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                            <select 
                                className="bg-transparent border-none text-slate-900 dark:text-white text-sm font-bold w-full focus:ring-0 p-0"
                                value={formData.gender}
                                onChange={e => {
                                    setFormData({...formData, gender: e.target.value});
                                    setErrors(prev => ({...prev, gender: ''}));
                                }}
                                onBlur={() => handleBlur('gender')}
                            >
                                <option value="" disabled className="text-slate-400 bg-white dark:bg-surface-dark">Select</option>
                                <option value="Male" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Male</option>
                                <option value="Female" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Female</option>
                                <option value="Other" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Other</option>
                            </select>
                        </div>
                        {errors.gender && touched.gender && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.gender}</p>}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Home Address</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.address && touched.address ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">home</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                            placeholder="Residential Address"
                            value={formData.address}
                            onChange={e => {
                                setFormData({...formData, address: e.target.value});
                                setErrors(prev => ({...prev, address: ''}));
                            }}
                            onBlur={() => handleBlur('address')}
                        />
                    </div>
                    {errors.address && touched.address && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.address}</p>}
                </div>

                <button 
                    onClick={handleNext}
                    className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-4"
                >
                    Continue
                </button>
            </div>
          )}

          {/* STEP 2 (DRIVER): IDENTITY DOCUMENTS */}
          {step === 2 && isDriver && (
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold mb-1">Identity & Safety</h2>
                    <p className="text-sm text-slate-500 font-medium">Verify your right to drive and identity.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">NIN Number</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.nin && touched.nin ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">id_card</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                            placeholder="11-digit National Identity"
                            inputMode="numeric"
                            value={formData.nin}
                            onChange={e => {
                                const val = filterDigits(e.target.value).slice(0, 11);
                                setFormData({...formData, nin: val});
                                setErrors(prev => ({...prev, nin: ''}));
                            }}
                            onBlur={() => handleBlur('nin')}
                        />
                    </div>
                    {errors.nin && touched.nin && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.nin}</p>}
                </div>

                <div className="flex flex-col gap-4">
                   <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest mb-[-8px]">Required Document Photos</label>
                   <div className="grid grid-cols-3 gap-3">
                      {/* Driver License */}
                      <button 
                         onClick={() => setShowSourceSelector('license')}
                         className={`flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border-2 border-dashed transition-all overflow-hidden relative ${formData.licenseImage ? 'border-green-500 bg-green-500/5' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-input-dark'}`}
                      >
                         {formData.licenseImage ? (
                            <img src={formData.licenseImage} className="w-full h-full object-cover" alt="" />
                         ) : (
                            <>
                               <span className="material-symbols-outlined text-slate-400">badge</span>
                               <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">License</span>
                            </>
                         )}
                         {isCapturing === 'license' && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-white">refresh</span></div>}
                      </button>

                      {/* Selfie */}
                      <button 
                         onClick={() => setShowSourceSelector('selfie')}
                         className={`flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border-2 border-dashed transition-all overflow-hidden relative ${formData.selfieImage ? 'border-green-500 bg-green-500/5' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-input-dark'}`}
                      >
                         {formData.selfieImage ? (
                            <img src={formData.selfieImage} className="w-full h-full object-cover" alt="" />
                         ) : (
                            <>
                               <span className="material-symbols-outlined text-slate-400">face</span>
                               <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Selfie</span>
                            </>
                         )}
                         {isCapturing === 'selfie' && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-white">refresh</span></div>}
                      </button>

                      {/* NIN Card */}
                      <button 
                         onClick={() => setShowSourceSelector('nin')}
                         className={`flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border-2 border-dashed transition-all overflow-hidden relative ${formData.ninImage ? 'border-green-500 bg-green-500/5' : 'border-slate-200 dark:border-white/5 bg-white dark:bg-input-dark'}`}
                      >
                         {formData.ninImage ? (
                            <img src={formData.ninImage} className="w-full h-full object-cover" alt="" />
                         ) : (
                            <>
                               <span className="material-symbols-outlined text-slate-400">id_card</span>
                               <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">NIN Card</span>
                            </>
                         )}
                         {isCapturing === 'nin' && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-white">refresh</span></div>}
                      </button>
                   </div>
                </div>

                <button 
                    onClick={handleNext}
                    className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-auto"
                >
                    Continue
                </button>
            </div>
          )}

          {/* STEP 2 (OWNER): VEHICLE DETAILS */}
          {step === 2 && !isDriver && (
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold mb-1">Vehicle Specs</h2>
                    <p className="text-sm text-slate-500 font-medium">Tell us about the car being used.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Luxury Car Category</label>
                    <div className="grid grid-cols-2 gap-3">
                        {['Standard', 'Executive', 'Luxury', 'SUV'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFormData({...formData, carType: type})}
                                className={`py-4 rounded-2xl text-sm font-bold border transition-all ${formData.carType === type ? 'bg-primary border-primary text-white' : 'bg-white dark:bg-surface-dark border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Model</label>
                        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.carModel && touched.carModel ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                            <input 
                                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                                placeholder="e.g. Camry"
                                value={formData.carModel}
                                onChange={e => {
                                    setFormData({...formData, carModel: e.target.value});
                                    setErrors(prev => ({...prev, carModel: ''}));
                                }}
                                onBlur={() => handleBlur('carModel')}
                            />
                        </div>
                        {errors.carModel && touched.carModel && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.carModel}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Year</label>
                        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.carYear && touched.carYear ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                            <input 
                                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0 text-center"
                                placeholder="20XX"
                                inputMode="numeric"
                                value={formData.carYear}
                                onChange={e => {
                                    setFormData({...formData, carYear: filterDigits(e.target.value).slice(0, 4)});
                                    setErrors(prev => ({...prev, carYear: ''}));
                                }}
                                onBlur={() => handleBlur('carYear')}
                            />
                        </div>
                        {errors.carYear && touched.carYear && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.carYear}</p>}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Transmission</label>
                        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.transmission && touched.transmission ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                            <select 
                                className="bg-transparent border-none text-slate-900 dark:text-white text-base font-bold w-full focus:ring-0 p-0"
                                value={formData.transmission}
                                onChange={e => {
                                    setFormData({...formData, transmission: e.target.value as any});
                                    setErrors(prev => ({...prev, transmission: ''}));
                                }}
                                onBlur={() => handleBlur('transmission')}
                            >
                                <option value="Automatic" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Automatic (Most Common)</option>
                                <option value="Manual" className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">Manual Transmission</option>
                            </select>
                        </div>
                        {errors.transmission && touched.transmission && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.transmission}</p>}
                    </div>

                <button 
                    onClick={handleNext}
                    className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-auto"
                >
                    Continue
                </button>
            </div>
          )}

          {/* STEP 3 (DRIVER): BANK DETAILS */}
          {step === 3 && isDriver && (
            <div className="flex flex-col gap-6 animate-fade-in">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold mb-1">Financial Setup</h2>
                    <p className="text-sm text-slate-500 font-medium">Where should we send your earnings?</p>
                </div>

                <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Your Bank</label>
                        <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.bankCode && touched.bankCode ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                            <select 
                                className="bg-transparent border-none text-slate-900 dark:text-white text-base font-bold w-full focus:ring-0 p-0"
                                value={formData.bankCode}
                                onChange={e => {
                                    const bank = banks.find(b => b.code === e.target.value);
                                    setFormData({...formData, bankCode: e.target.value, bankName: bank?.name || ''});
                                    setErrors(prev => ({...prev, bankCode: ''}));
                                }}
                                onBlur={() => handleBlur('bankCode')}
                            >
                                <option value="" disabled className="text-slate-400 bg-white dark:bg-surface-dark">Select your bank</option>
                                {banks.map(bank => (
                                    <option key={bank.code} value={bank.code} className="text-slate-900 dark:text-white bg-white dark:bg-surface-dark">{bank.name}</option>
                                ))}
                            </select>
                        </div>
                        {errors.bankCode && touched.bankCode && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.bankCode}</p>}
                    </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Account Number</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.accountNumber && touched.accountNumber ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">account_balance</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0"
                            placeholder="10 Digits"
                            inputMode="numeric"
                            value={formData.accountNumber}
                            onChange={e => {
                                setFormData({...formData, accountNumber: filterDigits(e.target.value).slice(0, 10)});
                                setErrors(prev => ({...prev, accountNumber: ''}));
                            }}
                            onBlur={() => handleBlur('accountNumber')}
                        />
                    </div>
                    {errors.accountNumber && touched.accountNumber && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.accountNumber}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Verified Account Name</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.accountName && touched.accountName ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">person_check</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                            placeholder="Enter Name as seen on Bank"
                            value={formData.accountName}
                            onChange={e => setFormData({...formData, accountName: e.target.value})}
                            onBlur={() => handleBlur('accountName')}
                        />
                    </div>
                </div>

                <button 
                    onClick={handleNext}
                    className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-auto"
                >
                    Continue
                </button>
            </div>
          )}

          {/* FINAL STEP: SECURITY & SUBMIT */}
          {((step === 4 && isDriver) || (step === 3 && !isDriver)) && (
             <div className="flex flex-col gap-6 animate-fade-in">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold mb-1">Secure Account</h2>
                    <p className="text-sm text-slate-500 font-medium">Protect your earnings and data.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Create Password</label>
                    <div className={`flex items-center bg-white dark:bg-surface-dark border rounded-2xl px-4 h-14 transition-all ${errors.password && touched.password ? 'border-red-500 bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                        <span className="material-symbols-outlined text-slate-400 mr-3 text-xl">lock</span>
                        <input 
                            className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-bold w-full focus:ring-0 p-0"
                            placeholder="Min. 6 characters"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={e => {
                                setFormData({...formData, password: e.target.value});
                                setErrors(prev => ({...prev, password: ''}));
                                }}
                            onBlur={() => handleBlur('password')}
                        />
                        <button onClick={() => setShowPassword(!showPassword)}><span className="material-symbols-outlined text-slate-400">{showPassword ? 'visibility_off' : 'visibility'}</span></button>
                    </div>
                    {errors.password && touched.password && <p className="text-[10px] text-red-500 font-bold ml-1 animate-fade-in">{errors.password}</p>}
                </div>
                
                {isDriver && (
                    <div className="p-5 bg-primary/5 rounded-[1.5rem] border border-primary/10 flex gap-4">
                        <input 
                            type="checkbox" 
                            id="audit_consent"
                            className="size-5 mt-1 rounded bg-transparent border-primary/40 text-primary"
                            checked={formData.backgroundCheckAccepted}
                            onChange={e => setFormData({...formData, backgroundCheckAccepted: e.target.checked})}
                        />
                        <label htmlFor="audit_consent" className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                            I verify that all information provided is accurate and truthful. I agree to <b>BICA's Background Check Policy</b> for professional chauffeurs.
                        </label>
                    </div>
                )}

                {!isDriver && (
                    <div className="p-5 bg-primary/5 rounded-[1.5rem] border border-primary/10 flex gap-4">
                        <input 
                            type="checkbox" 
                            id="terms_consent"
                            className="size-5 mt-1 rounded bg-transparent border-primary/40 text-primary"
                            checked={formData.backgroundCheckAccepted}
                            onChange={e => setFormData({...formData, backgroundCheckAccepted: e.target.checked})}
                        />
                        <label htmlFor="terms_consent" className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                            I agree to <b>BICA's Terms of Service</b> and verify that I am the legal owner of the vehicle registered.
                        </label>
                    </div>
                )}

                <button 
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full bg-primary py-5 rounded-2xl text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all mt-4 disabled:opacity-50"
                >
                    {isLoading ? 'Creating Account...' : 'Complete Registration'}
                </button>
             </div>
          )}
      </main>

      {/* Immediate Source Selection Modal */}
      {showSourceSelector && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setShowSourceSelector(null)}>
          <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-6">
              <h3 className="text-xl font-bold">Select Image Source</h3>
              <div className="grid grid-cols-2 gap-4 w-full">
                <button onClick={() => handleCapture(showSourceSelector!, CameraSource.Camera)} className="flex flex-col items-center gap-2 p-6 rounded-[2rem] bg-primary/5 border border-primary/10 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-3xl text-primary">photo_camera</span>
                  <span className="text-sm font-bold">Camera</span>
                </button>
                <button onClick={() => handleCapture(showSourceSelector!, CameraSource.Photos)} className="flex flex-col items-center gap-2 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-3xl text-slate-400">image</span>
                  <span className="text-sm font-bold">Gallery</span>
                </button>
              </div>
              <button 
                onClick={() => setShowSourceSelector(null)}
                className="w-full py-4 text-slate-500 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignUpScreen;
