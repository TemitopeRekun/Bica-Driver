
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, UserProfile } from '../types';
import { CapacitorService } from '../services/CapacitorService';
import { useToast } from '../hooks/useToast';
import { CameraSource } from '@capacitor/camera';
import { api } from '../services/api.service';

interface SignUpScreenProps {
  role: UserRole;
  onSignUp: (userData: Partial<UserProfile>) => void;
  onBack: () => void;
  onGoToLogin: () => void;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ role, onSignUp, onBack, onGoToLogin }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    carType: '',
    carModel: '',
    carYear: '',
    licenseImage: '',
    selfieImage: '',
    backgroundCheckAccepted: false,
    // New Fields
    gender: '',
    address: '',
    nationality: '',
    age: '',
    nin: '',
    ninImage: '',
    transmission: 'Automatic' as 'Manual' | 'Automatic' | 'Both'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isCapturing, setIsCapturing] = useState<'license' | 'selfie' | 'nin' | null>(null);
  const [showSourceSelector, setShowSourceSelector] = useState<'license' | 'selfie' | 'nin' | null>(null);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankFormData, setBankFormData] = useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Refs for focusing/scrolling to errors
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isDriver = role === UserRole.DRIVER;

  // Sanitization: digits only
  const filterDigits = (val: string) => val.replace(/\D/g, '');

  const validateField = (
    name: string,
    value: any,
    currentFormData: any,
    currentBankData: any,
    userRole: UserRole
  ): string => {
    const trimmedVal = typeof value === 'string' ? value.trim() : value;
    const isDriverRole = userRole === UserRole.DRIVER;

    switch (name) {
      case 'fullName':
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
        if (value.length < 6) return 'Password must be at least 6 characters';
        return '';

      case 'age':
        if (!value) return 'Age is required';
        const ageNum = parseInt(value, 10);
        if (isNaN(ageNum) || ageNum < 18) return 'You must be at least 18 years old';
        return '';

      case 'address':
        if (!trimmedVal) return 'Home address is required';
        return '';

      // Driver Specific
      case 'nin':
        if (isDriverRole) {
          const ninDigits = filterDigits(value);
          if (!ninDigits) return 'NIN is required';
          if (ninDigits.length !== 11) return 'NIN must be exactly 11 digits';
        }
        return '';

      case 'bankCode':
        if (isDriverRole && !value) return 'Please select your bank';
        return '';

      case 'accountNumber':
        if (isDriverRole) {
          const accDigits = filterDigits(value);
          if (!accDigits) return 'Account number is required';
          if (accDigits.length !== 10) return 'Account number must be 10 digits';
        }
        return '';

      case 'accountName':
        if (isDriverRole && !trimmedVal) return 'Account name is required';
        return '';

      // Owner Specific
      case 'nationality':
        if (!isDriverRole && !trimmedVal) return 'Nationality is required';
        return '';

      case 'gender':
        if (!isDriverRole && !value) return 'Gender is required';
        return '';

      case 'carType':
        if (!isDriverRole && !trimmedVal) return 'Car type is required';
        return '';

      case 'carModel':
        if (!isDriverRole && !trimmedVal) return 'Car model is required';
        return '';

      case 'carYear':
        if (!isDriverRole) {
          const yearDigits = filterDigits(value);
          if (!yearDigits) return 'Car year is required';
          if (yearDigits.length !== 4) return 'Enter a 4-digit year';
          const yearNum = parseInt(yearDigits, 10);
          const currentYear = new Date().getFullYear();
          if (yearNum < 1990 || yearNum > currentYear + 1) {
            return `Year must be between 1990 and ${currentYear + 1}`;
          }
        }
        return '';

      case 'transmission':
        if (!value) return 'Transmission type is required';
        return '';

      default:
        return '';
    }
  };

  const handleBlur = (name: string, value: any) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value, formData, bankFormData, role);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const scrollToFirstError = (allErrors: Record<string, string>) => {
    const firstErrorField = Object.keys(allErrors).find(key => allErrors[key]);
    if (firstErrorField && fieldRefs.current[firstErrorField]) {
      fieldRefs.current[firstErrorField]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (isDriver) {
      api.get<{ name: string; code: string }[]>('/payments/banks', false)
        .then(setBanks)
        .catch(console.error);
    }
  }, [isDriver]);

  const handleCapture = async (type: 'license' | 'selfie' | 'nin', source: CameraSource) => {
    setShowSourceSelector(null);
    setIsCapturing(type);
    try {
      const photo = await CapacitorService.takePhoto(source);
      if (photo) {
        if (type === 'license') setFormData(prev => ({ ...prev, licenseImage: photo }));
        if (type === 'selfie') setFormData(prev => ({ ...prev, selfieImage: photo }));
        if (type === 'nin') setFormData(prev => ({ ...prev, ninImage: photo }));
      }
    } finally {
      setIsCapturing(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const commonFields = ['fullName', 'email', 'phone', 'password', 'age', 'address'];
    const driverFields = ['nin', 'bankCode', 'accountNumber', 'accountName'];
    const ownerFields = ['nationality', 'gender', 'carType', 'carModel', 'carYear'];

    // 1. Validate common fields
    commonFields.forEach(field => {
      const error = validateField(field, (formData as any)[field], formData, bankFormData, role);
      if (error) newErrors[field] = error;
    });

    // 2. Validate role specific fields
    if (isDriver) {
      driverFields.forEach(field => {
        const value = field.startsWith('bank') || field === 'accountNumber' || field === 'accountName'
          ? (bankFormData as any)[field]
          : (formData as any)[field];
        const error = validateField(field, value, formData, bankFormData, role);
        if (error) newErrors[field] = error;
      });

      // Special checks for images and consent
      if (!formData.licenseImage || !formData.selfieImage || !formData.ninImage) {
        toast.warning("Please upload all required driver documents.");
        return;
      }
      if (!formData.backgroundCheckAccepted) {
        toast.warning("You must consent to the background check to register as a driver.");
        return;
      }
    } else {
      ownerFields.forEach(field => {
        const error = validateField(field, (formData as any)[field], formData, bankFormData, role);
        if (error) newErrors[field] = error;
      });
    }

    if (Object.values(newErrors).some(err => err)) {
      setErrors(newErrors);
      setTouched(Object.keys(newErrors).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      scrollToFirstError(newErrors);
      toast.error("Please fix the errors in the form before submitting.");
      return;
    }

    // Submit with trimmed data
    const trimmedFormData = {
      ...formData,
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      nationality: formData.nationality.trim(),
      carType: formData.carType.trim(),
      carModel: formData.carModel.trim(),
    };

    const trimmedBankData = {
      ...bankFormData,
      accountName: bankFormData.accountName.trim(),
    };

    onSignUp({
      name: trimmedFormData.fullName,
      email: trimmedFormData.email,
      phone: trimmedFormData.phone,
      password: trimmedFormData.password,
      carType: trimmedFormData.carType,
      carModel: trimmedFormData.carModel,
      carYear: trimmedFormData.carYear,
      licenseImage: trimmedFormData.licenseImage,
      selfieImage: trimmedFormData.selfieImage,
      backgroundCheckAccepted: trimmedFormData.backgroundCheckAccepted,
      avatar: trimmedFormData.selfieImage,
      gender: trimmedFormData.gender,
      address: trimmedFormData.address,
      nationality: trimmedFormData.nationality,
      age: trimmedFormData.age,
      nin: trimmedFormData.nin,
      ninImage: trimmedFormData.ninImage,
      bankName: trimmedBankData.bankName,
      bankCode: trimmedBankData.bankCode,
      accountNumber: trimmedBankData.accountNumber,
      accountName: trimmedBankData.accountName,
      transmission: trimmedFormData.transmission
    });
  };



  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark relative">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <button
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-tight text-center">
          {isDriver ? 'Driver Registration' : 'Owner Registration'}
        </h1>
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-4 pb-8 w-full overflow-y-auto no-scrollbar">
        <div className="flex flex-col mb-8 animate-slide-up">
          <h2 className="text-[28px] font-bold leading-tight mb-2">
            {isDriver ? 'Become a Driver' : 'Register Your Car'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-base">
            {isDriver ? 'Start earning by driving luxury cars.' : 'Hire professional drivers for your vehicle.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
          {/* Common Fields */}
          <div ref={el => fieldRefs.current['fullName'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
            <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.fullName && touched.fullName ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
              <span className={`material-symbols-outlined mr-3 ${errors.fullName && touched.fullName ? 'text-red-400' : 'text-slate-400'}`}>person</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="Enter your full name"
                type="text"
                value={formData.fullName}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value });
                  if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                }}
                onBlur={(e) => handleBlur('fullName', e.target.value)}
              />
            </div>
            {errors.fullName && touched.fullName && <p className="text-red-500 text-xs ml-1 font-medium select-none">{errors.fullName}</p>}
          </div>

          <div ref={el => fieldRefs.current['email'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
            <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.email && touched.email ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
              <span className={`material-symbols-outlined mr-3 ${errors.email && touched.email ? 'text-red-400' : 'text-slate-400'}`}>mail</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="email@example.com"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                onBlur={(e) => handleBlur('email', e.target.value)}
              />
            </div>
            {errors.email && touched.email && <p className="text-red-500 text-xs ml-1 font-medium select-none">{errors.email}</p>}
          </div>

          <div ref={el => fieldRefs.current['phone'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Phone Number</label>
            <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.phone && touched.phone ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
              <span className={`material-symbols-outlined mr-3 ${errors.phone && touched.phone ? 'text-red-400' : 'text-slate-400'}`}>phone_iphone</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="0000 000 0000"
                type="text"
                inputMode="numeric"
                value={formData.phone}
                onChange={(e) => {
                  const filtered = filterDigits(e.target.value).slice(0, 11);
                  setFormData({ ...formData, phone: filtered });
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                onBlur={(e) => handleBlur('phone', e.target.value)}
              />
            </div>
            {errors.phone && touched.phone && <p className="text-red-500 text-xs ml-1 font-medium select-none">{errors.phone}</p>}
          </div>

          {/* Role Specific Fields */}
          {!isDriver ? (
            // OWNER FIELDS
            <>
              <div className="grid grid-cols-2 gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <div ref={el => fieldRefs.current['gender'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Gender</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border transition-all ${errors.gender && touched.gender ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <select
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                      value={formData.gender}
                      onChange={(e) => {
                        setFormData({ ...formData, gender: e.target.value });
                        if (errors.gender) setErrors(prev => ({ ...prev, gender: '' }));
                      }}
                      onBlur={(e) => handleBlur('gender', e.target.value)}
                    >
                      <option value="" disabled className="dark:bg-surface-dark">Select</option>
                      <option value="Male" className="dark:bg-surface-dark">Male</option>
                      <option value="Female" className="dark:bg-surface-dark">Female</option>
                      <option value="Prefer not to say" className="dark:bg-surface-dark">Other</option>
                    </select>
                  </div>
                  {errors.gender && touched.gender && <p className="text-red-500 text-[10px] ml-1 font-medium">{errors.gender}</p>}
                </div>
                <div ref={el => fieldRefs.current['age'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Age</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.age && touched.age ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="e.g. 35"
                      type="text"
                      inputMode="numeric"
                      value={formData.age}
                      onChange={(e) => {
                        const filtered = filterDigits(e.target.value).slice(0, 3);
                        setFormData({ ...formData, age: filtered });
                        if (errors.age) setErrors(prev => ({ ...prev, age: '' }));
                      }}
                      onBlur={(e) => handleBlur('age', e.target.value)}
                    />
                  </div>
                  {errors.age && touched.age && <p className="text-red-500 text-[10px] ml-1 font-medium">{errors.age}</p>}
                </div>
              </div>

              <div ref={el => fieldRefs.current['nationality'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Nationality</label>
                <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.nationality && touched.nationality ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                  <span className={`material-symbols-outlined mr-3 ${errors.nationality && touched.nationality ? 'text-red-400' : 'text-slate-400'}`}>flag</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. Nigerian"
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => {
                      setFormData({ ...formData, nationality: e.target.value });
                      if (errors.nationality) setErrors(prev => ({ ...prev, nationality: '' }));
                    }}
                    onBlur={(e) => handleBlur('nationality', e.target.value)}
                  />
                </div>
                {errors.nationality && touched.nationality && <p className="text-red-500 text-xs ml-1 font-medium">{errors.nationality}</p>}
              </div>

              <div ref={el => fieldRefs.current['address'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Address</label>
                <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.address && touched.address ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                  <span className={`material-symbols-outlined mr-3 ${errors.address && touched.address ? 'text-red-400' : 'text-slate-400'}`}>home</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. 123 Victoria Island"
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                    }}
                    onBlur={(e) => handleBlur('address', e.target.value)}
                  />
                </div>
                {errors.address && touched.address && <p className="text-red-500 text-xs ml-1 font-medium">{errors.address}</p>}
              </div>

              <div ref={el => fieldRefs.current['carType'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Type of Car</label>
                <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.carType && touched.carType ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                  <span className={`material-symbols-outlined mr-3 ${errors.carType && touched.carType ? 'text-red-400' : 'text-slate-400'}`}>directions_car</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. Mercedes S-Class, BMW 7 Series"
                    type="text"
                    value={formData.carType}
                    onChange={(e) => {
                      setFormData({ ...formData, carType: e.target.value });
                      if (errors.carType) setErrors(prev => ({ ...prev, carType: '' }));
                    }}
                    onBlur={(e) => handleBlur('carType', e.target.value)}
                  />
                </div>
                {errors.carType && touched.carType && <p className="text-red-500 text-xs ml-1 font-medium">{errors.carType}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div ref={el => fieldRefs.current['carModel'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Model</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.carModel && touched.carModel ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary'}`}>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="e.g. Camry, S-Class"
                      type="text"
                      value={formData.carModel || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, carModel: e.target.value });
                        if (errors.carModel) setErrors(prev => ({ ...prev, carModel: '' }));
                      }}
                      onBlur={(e) => handleBlur('carModel', e.target.value)}
                    />
                  </div>
                  {errors.carModel && touched.carModel && <p className="text-red-500 text-[10px] ml-1 font-medium">{errors.carModel}</p>}
                </div>
                <div ref={el => fieldRefs.current['carYear'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Year</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.carYear && touched.carYear ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary'}`}>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="e.g. 2022"
                      type="text"
                      inputMode="numeric"
                      value={formData.carYear || ''}
                      onChange={(e) => {
                        const filtered = filterDigits(e.target.value).slice(0, 4);
                        setFormData({ ...formData, carYear: filtered });
                        if (errors.carYear) setErrors(prev => ({ ...prev, carYear: '' }));
                      }}
                      onBlur={(e) => handleBlur('carYear', e.target.value)}
                    />
                  </div>
                  {errors.carYear && touched.carYear && <p className="text-red-500 text-[10px] ml-1 font-medium">{errors.carYear}</p>}
                </div>
              </div>

              <div ref={el => fieldRefs.current['transmission'] = el} className="flex flex-col gap-1.5 mb-4">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Transmission</label>
                <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border transition-all ${errors.transmission && touched.transmission ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <select
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                    value={formData.transmission}
                    onChange={(e) => {
                      setFormData({ ...formData, transmission: e.target.value as any });
                      if (errors.transmission) setErrors(prev => ({ ...prev, transmission: '' }));
                    }}
                    onBlur={(e) => handleBlur('transmission', e.target.value)}
                  >
                    <option value="Automatic" className="dark:bg-surface-dark">Automatic</option>
                    <option value="Manual" className="dark:bg-surface-dark">Manual</option>
                  </select>
                </div>
                {errors.transmission && touched.transmission && <p className="text-red-500 text-xs ml-1 font-medium">{errors.transmission}</p>}
              </div>

            </>
          ) : (
            // DRIVER FIELDS
            <>
              <div className="grid grid-cols-2 gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <div ref={el => fieldRefs.current['age'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Age</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.age && touched.age ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="Age"
                      type="text"
                      inputMode="numeric"
                      value={formData.age}
                      onChange={(e) => {
                        const filtered = filterDigits(e.target.value).slice(0, 3);
                        setFormData({ ...formData, age: filtered });
                        if (errors.age) setErrors(prev => ({ ...prev, age: '' }));
                      }}
                      onBlur={(e) => handleBlur('age', e.target.value)}
                    />
                  </div>
                  {errors.age && touched.age && <p className="text-red-500 text-[10px] ml-1 font-medium">{errors.age}</p>}
                </div>
                <div ref={el => fieldRefs.current['transmission'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Transmission</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border transition-all ${errors.transmission && touched.transmission ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <select
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                      value={formData.transmission}
                      onChange={(e) => {
                        setFormData({ ...formData, transmission: e.target.value as any });
                        if (errors.transmission) setErrors(prev => ({ ...prev, transmission: '' }));
                      }}
                      onBlur={(e) => handleBlur('transmission', e.target.value)}
                    >
                      <option value="Manual" className="dark:bg-surface-dark">Manual</option>
                      <option value="Automatic" className="dark:bg-surface-dark">Automatic</option>
                      <option value="Both" className="dark:bg-surface-dark">Both</option>
                    </select>
                  </div>
                  {errors.transmission && touched.transmission && <p className="text-red-500 text-[10px] ml-1 font-medium">{errors.transmission}</p>}
                </div>
              </div>

              <div ref={el => fieldRefs.current['address'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Home Address</label>
                <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.address && touched.address ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                  <span className={`material-symbols-outlined mr-3 ${errors.address && touched.address ? 'text-red-400' : 'text-slate-400'}`}>home_pin</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. 10 Admiralty Way"
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                    }}
                    onBlur={(e) => handleBlur('address', e.target.value)}
                  />
                </div>
                {errors.address && touched.address && <p className="text-red-500 text-xs ml-1 font-medium">{errors.address}</p>}
              </div>

              <div ref={el => fieldRefs.current['nin'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">NIN Number</label>
                <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.nin && touched.nin ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                  <span className={`material-symbols-outlined mr-3 ${errors.nin && touched.nin ? 'text-red-400' : 'text-slate-400'}`}>fingerprint</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="National Identity Number"
                    type="text"
                    inputMode="numeric"
                    value={formData.nin}
                    onChange={(e) => {
                      const filtered = filterDigits(e.target.value).slice(0, 11);
                      setFormData({ ...formData, nin: filtered });
                      if (errors.nin) setErrors(prev => ({ ...prev, nin: '' }));
                    }}
                    onBlur={(e) => handleBlur('nin', e.target.value)}
                  />
                </div>
                {errors.nin && touched.nin && <p className="text-red-500 text-xs ml-1 font-medium">{errors.nin}</p>}
              </div>

              {/* Bank Details — Driver Only */}
              <div className="flex flex-col gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Bank Details</p>

                <div ref={el => fieldRefs.current['bankCode'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Bank</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border transition-all ${errors.bankCode && touched.bankCode ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800'}`}>
                    <select
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                      value={bankFormData.bankCode}
                      onChange={(e) => {
                        const bank = banks.find(b => b.code === e.target.value);
                        setBankFormData(prev => ({
                          ...prev,
                          bankCode: e.target.value,
                          bankName: bank?.name || '',
                        }));
                        if (errors.bankCode) setErrors(prev => ({ ...prev, bankCode: '' }));
                      }}
                      onBlur={(e) => handleBlur('bankCode', e.target.value)}
                    >
                      <option value="" disabled className="dark:bg-surface-dark">Select your bank</option>
                      {banks.map(bank => (
                        <option key={bank.code} value={bank.code} className="dark:bg-surface-dark">
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.bankCode && touched.bankCode && <p className="text-red-500 text-xs ml-1 font-medium">{errors.bankCode}</p>}
                </div>

                <div ref={el => fieldRefs.current['accountNumber'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Account Number</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.accountNumber && touched.accountNumber ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                    <span className={`material-symbols-outlined mr-3 ${errors.accountNumber && touched.accountNumber ? 'text-red-400' : 'text-slate-400'}`}>account_balance</span>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="10-digit account number"
                      type="text"
                      inputMode="numeric"
                      value={bankFormData.accountNumber}
                      onChange={(e) => {
                        const filtered = filterDigits(e.target.value).slice(0, 10);
                        setBankFormData(prev => ({ ...prev, accountNumber: filtered }));
                        if (errors.accountNumber) setErrors(prev => ({ ...prev, accountNumber: '' }));
                      }}
                      onBlur={(e) => handleBlur('accountNumber', e.target.value)}
                    />
                  </div>
                  {errors.accountNumber && touched.accountNumber && <p className="text-red-500 text-xs ml-1 font-medium">{errors.accountNumber}</p>}
                </div>

                <div ref={el => fieldRefs.current['accountName'] = el} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Account Name</label>
                  <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.accountName && touched.accountName ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
                    <span className={`material-symbols-outlined mr-3 ${errors.accountName && touched.accountName ? 'text-red-400' : 'text-slate-400'}`}>person</span>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="Name on your bank account"
                      type="text"
                      value={bankFormData.accountName}
                      onChange={(e) => {
                        setBankFormData(prev => ({ ...prev, accountName: e.target.value }));
                        if (errors.accountName) setErrors(prev => ({ ...prev, accountName: '' }));
                      }}
                      onBlur={(e) => handleBlur('accountName', e.target.value)}
                    />
                  </div>
                  {errors.accountName && touched.accountName && <p className="text-red-500 text-xs ml-1 font-medium">{errors.accountName}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 mb-[-8px]">Required Documents</p>

                {/* Image Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* License */}
                  <button
                    type="button"
                    onClick={() => setShowSourceSelector('license')}
                    className={`flex flex-col items-center justify-center gap-1 h-32 rounded-xl border-2 border-dashed transition-all relative overflow-hidden group ${formData.licenseImage ? 'border-green-500 bg-green-500/5' : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-input-dark hover:border-primary'
                      }`}
                  >
                    {isCapturing === 'license' ? (
                      <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                    ) : formData.licenseImage ? (
                      <>
                        <img src={formData.licenseImage} className="w-full h-full object-cover" alt="License" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">Update</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-slate-400 text-2xl">badge</span>
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">License</span>
                      </>
                    )}
                  </button>

                  {/* Selfie */}
                  <button
                    type="button"
                    onClick={() => setShowSourceSelector('selfie')}
                    className={`flex flex-col items-center justify-center gap-1 h-32 rounded-xl border-2 border-dashed transition-all relative overflow-hidden group ${formData.selfieImage ? 'border-green-500 bg-green-500/5' : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-input-dark hover:border-primary'
                      }`}
                  >
                    {isCapturing === 'selfie' ? (
                      <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                    ) : formData.selfieImage ? (
                      <>
                        <img src={formData.selfieImage} className="w-full h-full object-cover" alt="Selfie" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">Update</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-slate-400 text-2xl">photo_camera</span>
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Selfie</span>
                      </>
                    )}
                  </button>

                  {/* NIN Image */}
                  <button
                    type="button"
                    onClick={() => setShowSourceSelector('nin')}
                    className={`flex flex-col items-center justify-center gap-1 h-32 rounded-xl border-2 border-dashed transition-all relative overflow-hidden group ${formData.ninImage ? 'border-green-500 bg-green-500/5' : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-input-dark hover:border-primary'
                      }`}
                  >
                    {isCapturing === 'nin' ? (
                      <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                    ) : formData.ninImage ? (
                      <>
                        <img src={formData.ninImage} className="w-full h-full object-cover" alt="NIN" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">Update</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-slate-400 text-2xl">id_card</span>
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">NIN Card</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <input
                    type="checkbox"
                    id="bg-check"
                    required
                    checked={formData.backgroundCheckAccepted}
                    onChange={(e) => setFormData({ ...formData, backgroundCheckAccepted: e.target.checked })}
                    className="mt-1 rounded border-slate-300 dark:border-slate-700 bg-transparent text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="bg-check" className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium cursor-pointer">
                    I consent to a professional background check including criminal history and driving record verification.
                  </label>
                </div>
              </div>
            </>
          )}

          <div ref={el => fieldRefs.current['password'] = el} className="flex flex-col gap-1.5 animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Password</label>
            <div className={`flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border transition-all ${errors.password && touched.password ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}>
              <span className={`material-symbols-outlined mr-3 ${errors.password && touched.password ? 'text-red-400' : 'text-slate-400'}`}>lock</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="Create a password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                }}
                onBlur={(e) => handleBlur('password', e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex items-center justify-center p-1 hover:text-primary transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined text-slate-400">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {errors.password && touched.password && <p className="text-red-500 text-xs ml-1 font-medium">{errors.password}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-blue-600 active:bg-blue-700 text-white font-bold text-lg h-16 rounded-xl shadow-lg shadow-primary/25 mt-4 transition-all transform active:scale-[0.98] animate-slide-up stagger-3 opacity-0"
            style={{ animationFillMode: 'forwards' }}
          >
            Complete Registration
          </button>
        </form>
      </main>

      <footer className="p-6 text-center animate-fade-in stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Already have an account?
          <span
            onClick={onGoToLogin}
            className="text-primary font-bold hover:underline ml-1 cursor-pointer transition-colors"
          >
            Log In
          </span>
        </p>
      </footer>

      {/* Immediate Source Selection Modal */}
      {showSourceSelector && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in"
          onClick={() => setShowSourceSelector(null)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="h-1 w-12 bg-slate-200 dark:bg-slate-700 rounded-full mb-2"></div>
              <h3 className="text-xl font-bold">Select Image Source</h3>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button
                  onClick={() => handleCapture(showSourceSelector!, CameraSource.Camera)}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group active:scale-95"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">photo_camera</span>
                  </div>
                  <span className="font-bold text-sm">Take Photo</span>
                </button>

                <button
                  onClick={() => handleCapture(showSourceSelector!, CameraSource.Photos)}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-colors group active:scale-95"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl">image</span>
                  </div>
                  <span className="font-bold text-sm">From Gallery</span>
                </button>
              </div>

              <button
                onClick={() => setShowSourceSelector(null)}
                className="w-full py-4 text-slate-500 font-bold hover:text-slate-800 transition-colors"
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
