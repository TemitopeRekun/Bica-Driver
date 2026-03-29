
import React, { useState, useEffect } from 'react';
import { UserRole, UserProfile } from '../types';
import { CapacitorService } from '../services/CapacitorService';
import { CameraSource } from '@capacitor/camera';
import { api } from '../services/api.service';

interface SignUpScreenProps {
  role: UserRole;
  onSignUp: (userData: Partial<UserProfile>) => void;
  onBack: () => void;
  onGoToLogin: () => void;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ role, onSignUp, onBack, onGoToLogin }) => {
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
  const isDriver = role === UserRole.DRIVER;

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

    // Validation
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password) {
      alert("Please fill in all required fields.");
      return;
    }
    if (isDriver) {
      if (!formData.licenseImage || !formData.selfieImage || !formData.ninImage || !formData.backgroundCheckAccepted) {
        alert("Please complete all driver requirements including Driver License, Selfie, NIN image, and background check consent.");
        return;
      }
      if (!formData.nin || !formData.address || !formData.age) {
        alert("Please fill in all personal details including Address, Age and NIN.");
        return;
      }
      if (!bankFormData.bankCode || !bankFormData.accountNumber || !bankFormData.accountName) {
        alert("Please provide your bank details.");
        return;
      }
    } else {
      if (!formData.carType || !formData.carModel || !formData.carYear || !formData.address || !formData.nationality || !formData.age || !formData.gender) {
        alert("Please complete all profile details including Address, Nationality, Age, Gender, Car Type, Car Model and Car Year.");
        return;
      }
    }


    onSignUp({
      name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      carType: formData.carType,
      carModel: formData.carModel,
      carYear: formData.carYear,
      licenseImage: formData.licenseImage,
      selfieImage: formData.selfieImage,
      backgroundCheckAccepted: formData.backgroundCheckAccepted,
      avatar: formData.selfieImage, // Use selfie as avatar for drivers
      // New Fields
      gender: formData.gender,
      address: formData.address,
      nationality: formData.nationality,
      age: formData.age,
      nin: formData.nin,
      ninImage: formData.ninImage,
      bankName: bankFormData.bankName,
      bankCode: bankFormData.bankCode,
      accountNumber: bankFormData.accountNumber,
      accountName: bankFormData.accountName,
      transmission: formData.transmission
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
          <div className="flex flex-col gap-1.5 animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">person</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="Enter your full name"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">mail</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="email@example.com"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Phone Number</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">phone_iphone</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="+234 000 000 0000"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Role Specific Fields */}
          {!isDriver ? (
            // OWNER FIELDS
            <>
              <div className="grid grid-cols-2 gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Gender</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border border-slate-200 dark:border-slate-800">
                    <select
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    >
                      <option value="" disabled className="dark:bg-surface-dark">Select</option>
                      <option value="Male" className="dark:bg-surface-dark">Male</option>
                      <option value="Female" className="dark:bg-surface-dark">Female</option>
                      <option value="Prefer not to say" className="dark:bg-surface-dark">Other</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Age</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800">
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="e.g. 35"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Nationality</label>
                <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <span className="material-symbols-outlined text-slate-400 mr-3">flag</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. Nigerian"
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Address</label>
                <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <span className="material-symbols-outlined text-slate-400 mr-3">home</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. 123 Victoria Island"
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Type of Car</label>
                <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <span className="material-symbols-outlined text-slate-400 mr-3">directions_car</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. Mercedes S-Class, BMW 7 Series"
                    type="text"
                    value={formData.carType}
                    onChange={(e) => setFormData({ ...formData, carType: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Model</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary transition-all">
                    <input
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="e.g. Camry, S-Class"
                      type="text"
                      value={formData.carModel || ''}
                      onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Year</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary transition-all">
                    <input
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="e.g. 2022"
                      type="number"
                      value={formData.carYear || ''}
                      onChange={(e) => setFormData({ ...formData, carYear: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Transmission</label>
                <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border border-slate-200 dark:border-slate-800">
                  <select
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                    value={formData.transmission}
                    onChange={(e) => setFormData({ ...formData, transmission: e.target.value as any })}
                  >
                    <option value="Automatic" className="dark:bg-surface-dark">Automatic</option>
                    <option value="Manual" className="dark:bg-surface-dark">Manual</option>
                  </select>
                </div>
              </div>

            </>
          ) : (
            // DRIVER FIELDS
            <>
              <div className="grid grid-cols-2 gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Age</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800">
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="Age"
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Transmission</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border border-slate-200 dark:border-slate-800">
                    <select
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white text-base font-medium w-full focus:ring-0 p-0"
                      value={formData.transmission}
                      onChange={(e) => setFormData({ ...formData, transmission: e.target.value as any })}
                    >
                      <option value="Manual" className="dark:bg-surface-dark">Manual</option>
                      <option value="Automatic" className="dark:bg-surface-dark">Automatic</option>
                      <option value="Both" className="dark:bg-surface-dark">Both</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Home Address</label>
                <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <span className="material-symbols-outlined text-slate-400 mr-3">home_pin</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="e.g. 10 Admiralty Way"
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">NIN Number</label>
                <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <span className="material-symbols-outlined text-slate-400 mr-3">fingerprint</span>
                  <input
                    required
                    className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                    placeholder="National Identity Number"
                    type="text"
                    value={formData.nin}
                    onChange={(e) => setFormData({ ...formData, nin: e.target.value })}
                  />
                </div>
              </div>

              {/* Bank Details — Driver Only */}
              <div className="flex flex-col gap-4 animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Bank Details</p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Bank</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-3 h-14 border border-slate-200 dark:border-slate-800">
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
                      }}
                    >
                      <option value="" disabled className="dark:bg-surface-dark">Select your bank</option>
                      {banks.map(bank => (
                        <option key={bank.code} value={bank.code} className="dark:bg-surface-dark">
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Account Number</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                    <span className="material-symbols-outlined text-slate-400 mr-3">account_balance</span>
                    <input
                      required
                      maxLength={10}
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="10-digit account number"
                      type="text"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Account Name</label>
                  <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                    <span className="material-symbols-outlined text-slate-400 mr-3">person</span>
                    <input
                      required
                      className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                      placeholder="Name on your bank account"
                      type="text"
                      value={bankFormData.accountName}
                      onChange={(e) => setBankFormData(prev => ({ ...prev, accountName: e.target.value }))}
                    />
                  </div>
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

          <div className="flex flex-col gap-1.5 animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Password</label>
            <div className="flex items-center bg-white dark:bg-input-dark rounded-xl px-4 h-14 border border-slate-200 dark:border-slate-800 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <span className="material-symbols-outlined text-slate-400 mr-3">lock</span>
              <input
                required
                className="bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 text-base font-medium w-full focus:ring-0 p-0"
                placeholder="Create a password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
            className="w-full max-w-md bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-2xl animate-slide-up"
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
