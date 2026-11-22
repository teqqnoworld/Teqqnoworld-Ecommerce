import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Heart, User, Clock, Menu, X, ChevronDown, ShieldCheck, ShieldAlert, LogOut, Package, Truck, Receipt, MapPin } from 'lucide-react';
import { UserProfile } from '../types';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';
import { WhatsAppIcon } from './WhatsAppIcon';
import { SOCIAL_CHANNELS } from './SocialMediaIcons';
import { DelhiveryPincodeCheckResult } from '../services/paymentAndLogisticsService';
import { getSavedDelhiveryCheck, subscribeDelhiveryCheck } from '../services/delhiveryPincodeStore';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  wishlistCount?: number;
  onOpenWishlist?: () => void;
  onOpenSearch: () => void;
  onOpenAccount: () => void;
  user?: UserProfile | null;
  onLogout?: () => void;
  onOpenQuoteCalculator?: () => void;
  onOpenBundleBuilder?: () => void;
  onOpenDownloadCatalog?: () => void;
  onOpenTracking?: () => void;
  onOpenAppointment?: () => void;
  onOpenDeliveryCheck?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  cartCount,
  cartTotal,
  onOpenCart,
  wishlistCount = 0,
  onOpenWishlist,
  onOpenSearch,
  onOpenAccount,
  user,
  onLogout,
  onOpenQuoteCalculator,
  onOpenBundleBuilder,
  onOpenDownloadCatalog,
  onOpenTracking,
  onOpenAppointment,
  onOpenDeliveryCheck,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [savedDelivery, setSavedDelivery] = useState<DelhiveryPincodeCheckResult | null>(() =>
    getSavedDelhiveryCheck()
  );

  useEffect(() => {
    return subscribeDelhiveryCheck(setSavedDelivery);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 shadow-xs">
      {/* 1. Main Navbar Row */}
      <div className="max-w-7xl mx-auto px-2.5 xs:px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20 gap-1 xs:gap-1.5 sm:gap-3 lg:gap-4">
          
          {/* Logo & Branding */}
          <a
            href="/"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onNavigate('home');
              }
            }}
            className="flex items-center gap-1.5 sm:gap-2.5 text-left shrink-0 group focus:outline-none min-h-[44px] py-1 cursor-pointer"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 xl:w-9 xl:h-9 rounded-lg bg-[#FF7A00] flex items-center justify-center font-display font-bold text-white text-sm sm:text-base xl:text-lg shadow-md shadow-[#FF7A00]/25 group-hover:scale-105 transition-transform shrink-0">
              T
            </div>
            <div>
              <div className="font-display font-bold text-base xs:text-lg sm:text-xl xl:text-2xl tracking-tight text-[#0B0B0D] leading-none">
                Teqqno<span className="text-[#FF7A00]">World</span>
              </div>
              <div className="hidden sm:block text-[8px] xl:text-[9px] font-mono tracking-widest text-zinc-400 uppercase mt-0.5">
                PRINTING • BRANDING • SOLUTIONS
              </div>
            </div>
          </a>

          {/* Central Search Bar (Desktop & Large Tablets) */}
          <div className="hidden lg:flex flex-1 min-w-[200px] max-w-md xl:max-w-lg mx-1 xl:mx-3">
            <div
              role="button"
              tabIndex={0}
              aria-label="Search custom products"
              onClick={onOpenSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenSearch();
                }
              }}
              className="w-full h-10 xl:h-11 bg-zinc-50/90 hover:bg-white border border-zinc-200/90 hover:border-[#FF7A00]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]/30 focus-visible:border-[#FF7A00] rounded-full pl-1.5 pr-1.5 py-1 flex items-center justify-between gap-2 cursor-pointer transition-all duration-200 shadow-[0_2px_10px_-3px_rgba(11,11,13,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_10px_26px_-8px_rgba(255,122,0,0.2),0_2px_8px_-2px_rgba(11,11,13,0.06)] hover:-translate-y-[1px] group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-center shrink-0 group-hover:bg-[#FF7A00] group-hover:border-[#FF7A00] transition-colors duration-200">
                  <Search className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors duration-200" />
                </div>
                <span className="text-xs xl:text-[13px] font-medium text-zinc-500 group-hover:text-zinc-800 truncate transition-colors duration-200">
                  Search polos, mugs, standees, visiting cards...
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <kbd className="hidden xl:inline-flex items-center font-mono text-[10px] font-semibold text-zinc-400 bg-white border border-zinc-200 border-b-2 px-1.5 py-0.5 rounded-md shadow-2xs group-hover:border-[#FF7A00]/35 group-hover:text-[#FF7A00] transition-colors duration-200">
                  ⌘K
                </kbd>
                <span className="inline-flex items-center justify-center bg-[#0B0B0D] group-hover:bg-[#FF7A00] text-white text-[11px] font-semibold px-3 xl:px-3.5 h-7 xl:h-8 rounded-full shadow-xs transition-colors duration-200 whitespace-nowrap shrink-0">
                  Search
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Icons & Buttons */}
          <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-2 xl:gap-2.5 shrink-0">
            {/* Mobile & Tablet search trigger */}
            <button
              onClick={onOpenSearch}
              className="lg:hidden w-9 h-9 xs:w-10 xs:h-10 flex items-center justify-center p-1.5 text-zinc-700 hover:text-[#0B0B0D] hover:bg-zinc-100 rounded-xl transition-colors group cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-5 h-5 group-hover:rotate-12 group-hover:scale-115 transition-transform duration-300" />
            </button>

            {/* 5 Official Social Media Icons Pill beside WhatsApp (XL desktop only to avoid tablet crowding) */}
            <nav
              aria-label="Social Media Channels"
              className="hidden xl:flex items-center gap-1 bg-zinc-50/90 border border-zinc-200/85 rounded-full px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] shrink-0"
            >
              {SOCIAL_CHANNELS.map(({ id, label, href, Icon, restColorClass, hoverClass }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow TeqqnoWorld on ${label}`}
                  title={label}
                  className={`w-6 h-6 xl:w-7 xl:h-7 rounded-full bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${restColorClass} ${hoverClass}`}
                >
                  <Icon className="w-3 h-3 xl:w-3.5 xl:h-3.5 transition-transform duration-200" />
                </a>
              ))}
            </nav>

            {/* WhatsApp Quote Button */}
            <a
              href={getWhatsAppLink('Hi TeqqnoWorld, I want to request an instant quote for custom merchandise.')}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 bg-[#1EBE5D] hover:bg-[#19a851] text-white text-xs font-semibold px-3 xl:px-4 py-2 rounded-full shadow-xs transition-all hover:scale-102 min-h-[38px] xl:min-h-[40px] whitespace-nowrap shrink-0 group"
            >
              <WhatsAppIcon className="w-4 h-4 text-white group-hover:animate-icon-ring transition-transform shrink-0" />
              <span className="hidden lg:inline">WhatsApp Quote</span>
              <span className="lg:hidden">WhatsApp</span>
            </a>

            {/* Wishlist Trigger */}
            {onOpenWishlist && (
              <button
                type="button"
                onClick={onOpenWishlist}
                className="relative flex items-center justify-center w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-xl hover:bg-zinc-100 transition-colors text-zinc-800 group cursor-pointer shrink-0"
                aria-label={`Wishlist (${wishlistCount} saved)`}
                title="Wishlist"
              >
                <div className="relative flex items-center justify-center">
                  <Heart
                    className={`w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] stroke-[1.9] transition-all duration-200 ${
                      wishlistCount > 0
                        ? 'text-[#0B0B0D] group-hover:text-rose-500 group-hover:scale-110'
                        : 'text-zinc-800 group-hover:text-[#FF7A00] group-hover:scale-110'
                    }`}
                  />
                  <span
                    className="absolute -top-2 -right-2 bg-[#0B0B0D] text-white text-[9px] sm:text-[10px] font-bold font-mono tabular-nums rounded-full min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] px-1 flex items-center justify-center shadow-xs leading-none"
                  >
                    {wishlistCount}
                  </span>
                </div>
              </button>
            )}

            {/* Cart Trigger */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-1.5 sm:gap-2 w-9 h-9 xs:w-10 xs:h-10 lg:w-auto lg:h-auto lg:p-2 rounded-xl hover:bg-zinc-100 transition-colors text-zinc-800 sm:min-h-[44px] justify-center group cursor-pointer shrink-0"
              aria-label="Shopping Cart"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-zinc-700 group-hover:text-[#FF7A00] group-hover:-rotate-12 group-hover:scale-115 transition-all duration-300" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#FF7A00] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="text-[10px] text-zinc-400 font-medium">Cart</span>
                <span className="text-xs font-bold font-mono text-[#0B0B0D] group-hover:text-[#FF7A00] transition-colors">
                  ₹{cartTotal.toLocaleString('en-IN')}.00
                </span>
              </div>
            </button>

            {/* User Profile / Account Trigger */}
            <div className="relative">
              {user ? (
                <div>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-xl hover:bg-zinc-100 transition-colors border border-zinc-200/90 text-left min-h-[38px] sm:min-h-[44px] cursor-pointer"
                    title="Account Menu"
                  >
                    <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-lg bg-[#FF7A00] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="hidden md:flex flex-col leading-none pr-1">
                      <span className="text-[11px] font-bold text-zinc-900 truncate max-w-[80px] lg:max-w-[100px]">
                        {user.name.split(' ')[0]}
                      </span>
                      <span className="text-[9px] text-[#FF7A00] font-mono font-medium">B2B Portal</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 hidden md:block" />
                  </button>

                  {/* Account Dropdown Menu */}
                  {userDropdownOpen && (
                    <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserDropdownOpen(false)}
                    />
                    <div 
                      className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-1.5rem))] bg-white rounded-2xl border border-zinc-200 shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/70">
                        <div className="font-bold text-zinc-900 truncate">{user.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">+91 {user.mobile}</div>
                        {user.companyName && (
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{user.companyName}</div>
                        )}
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => onNavigate('dashboard')}
                          className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 text-zinc-800 font-medium flex items-center gap-2.5 min-h-[40px]"
                        >
                          <User className="w-3.5 h-3.5 text-[#FF7A00]" />
                          <span>Dashboard Overview</span>
                        </button>
                        <button
                          onClick={() => onNavigate('dashboard')}
                          className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 text-zinc-800 font-medium flex items-center gap-2.5 min-h-[40px]"
                        >
                          <Package className="w-3.5 h-3.5 text-zinc-500" />
                          <span>My Orders & Proofs</span>
                        </button>
                        <button
                          onClick={() => onNavigate('dashboard')}
                          className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 text-zinc-800 font-medium flex items-center gap-2.5 min-h-[40px]"
                        >
                          <Truck className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Track Consignment</span>
                        </button>
                        <button
                          onClick={() => onNavigate('dashboard')}
                          className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 text-zinc-800 font-medium flex items-center gap-2.5 min-h-[40px]"
                        >
                          <Receipt className="w-3.5 h-3.5 text-zinc-500" />
                          <span>GST Tax Invoices</span>
                        </button>
                      </div>

                      <div className="pt-1 border-t border-zinc-100">
                        <button
                          onClick={() => {
                            if (onLogout) onLogout();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium flex items-center gap-2.5 min-h-[40px]"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={onOpenAccount}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-800 text-xs font-semibold transition-colors min-h-[38px] sm:min-h-[44px] cursor-pointer"
                  title="Login / Register"
                >
                  <User className="w-4 h-4 text-[#FF7A00]" />
                  <span className="hidden md:inline">Sign In</span>
                </button>
              )}
            </div>

            {/* Mobile & Tablet Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center p-1.5 sm:p-2 text-zinc-700 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-[#FF7A00]" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* 2. Secondary Navigation Sub-Row (White Background - Desktop & Tablets) */}
      <div className="hidden md:block border-t border-zinc-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 sm:h-11 text-xs">
            
            {/* Nav links - smoothly scrollable on tablet with no visible scrollbar */}
            <nav aria-label="Primary Store Navigation" className="flex items-center gap-4 sm:gap-5 lg:gap-6 overflow-x-auto no-scrollbar touch-pan-x py-1">
              <a
                href="/catalog"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('catalog');
                  }
                }}
                className={`font-medium transition-colors hover:text-[#FF7A00] py-1.5 whitespace-nowrap shrink-0 min-h-[36px] flex items-center cursor-pointer ${
                  currentTab === 'catalog' ? 'text-[#FF7A00] font-bold' : 'text-zinc-700'
                }`}
              >
                Shop by Category
              </a>

              {onOpenQuoteCalculator && (
                <button
                  onClick={onOpenQuoteCalculator}
                  className="font-medium text-zinc-700 hover:text-[#FF7A00] flex items-center gap-1 py-1.5 whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer"
                >
                  <span>B2B Quote Calculator</span>
                  <span className="text-[9px] font-bold bg-[#FF7A00] text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    CALCULATOR
                  </span>
                </button>
              )}

              {onOpenBundleBuilder && (
                <button
                  onClick={onOpenBundleBuilder}
                  className="font-medium text-zinc-700 hover:text-[#FF7A00] flex items-center gap-1 py-1.5 whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer"
                >
                  <span>Gift Bundles</span>
                  <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    NEW
                  </span>
                </button>
              )}

              <button
                onClick={() => onNavigate('customizer')}
                className={`font-medium transition-colors hover:text-[#FF7A00] py-1.5 whitespace-nowrap shrink-0 min-h-[36px] flex items-center cursor-pointer ${
                  currentTab === 'customizer' ? 'text-[#FF7A00] font-bold' : 'text-zinc-700'
                }`}
              >
                Customize Logo
              </button>

              <a
                href="/bulk"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('bulk');
                  }
                }}
                className={`font-medium transition-colors hover:text-[#FF7A00] py-1.5 whitespace-nowrap shrink-0 min-h-[36px] flex items-center cursor-pointer ${
                  currentTab === 'bulk' ? 'text-[#FF7A00] font-bold' : 'text-zinc-700'
                }`}
              >
                Bulk RFQ
              </a>

              {onOpenAppointment && (
                <button
                  onClick={onOpenAppointment}
                  className="font-semibold text-zinc-800 hover:text-[#FF7A00] flex items-center gap-1.5 py-1.5 whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer bg-zinc-50 hover:bg-[#FF7A00]/10 px-2.5 rounded-lg border border-zinc-200/80 hover:border-[#FF7A00]/30 transition-all"
                >
                  <span className="text-sm">📅</span>
                  <span>Book Appointment</span>
                  <span className="text-[9px] font-bold bg-[#FF7A00] text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    FREE
                  </span>
                </button>
              )}

              {onOpenTracking && (
                <button
                  onClick={onOpenTracking}
                  className="font-medium text-zinc-700 hover:text-[#FF7A00] py-1.5 whitespace-nowrap shrink-0 min-h-[36px] flex items-center gap-1 cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Track Consignment</span>
                </button>
              )}

              {onOpenDownloadCatalog && (
                <button
                  onClick={onOpenDownloadCatalog}
                  className="font-medium text-zinc-700 hover:text-[#FF7A00] py-1.5 whitespace-nowrap shrink-0 min-h-[36px] flex items-center cursor-pointer"
                >
                  Catalogues PDF
                </button>
              )}

              <a
                href="/dashboard"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('dashboard');
                  }
                }}
                className={`font-medium transition-colors hover:text-[#FF7A00] flex items-center gap-1.5 py-1.5 whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer ${
                  currentTab === 'dashboard' ? 'text-[#FF7A00] font-bold' : 'text-zinc-700'
                }`}
              >
                <span>Dashboard & Invoices</span>
                {user && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                )}
              </a>
            </nav>

            {/* Right Dispatch & Delhivery Area Check */}
            <div className="hidden lg:flex items-center gap-3 shrink-0 pl-4">
              {onOpenDeliveryCheck ? (
                <button
                  type="button"
                  onClick={onOpenDeliveryCheck}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:border-[#FF7A00]/50 hover:bg-orange-50/60 text-zinc-700 font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Check Delhivery delivery availability in your area"
                >
                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${savedDelivery?.serviceable ? 'text-emerald-600' : 'text-[#FF7A00]'}`} />
                  <span className="font-semibold text-[#071B35]">
                    {savedDelivery?.serviceable
                      ? `Delhivery · ${savedDelivery.pincode}${savedDelivery.city ? ` (${savedDelivery.city})` : ''}`
                      : 'Check Delhivery Area'}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span className="font-medium text-zinc-700">24–48h Fast Dispatch</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden absolute top-full left-0 right-0 h-[calc(100dvh-100%)] min-h-[calc(100vh-100%)] z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-start animate-in fade-in duration-200 p-2 sm:p-3 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="mt-2 sm:mt-2.5 bg-white rounded-2xl border border-zinc-200/90 shadow-2xl px-4 py-4 space-y-4 max-h-[calc(85dvh-2rem)] overflow-y-auto pb-safe"
          >
            
            {/* Mobile Quick Search Bar */}
            <div
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSearch();
              }}
              className="bg-zinc-100 border border-zinc-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-zinc-500 text-xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#FF7A00]" />
                <span>Search custom polos, hoodies, gifts...</span>
              </div>
              <span className="text-[10px] bg-white border border-zinc-200 px-2 py-0.5 rounded font-mono">
                Search
              </span>
            </div>

            {/* Nav Links with 44px tap targets */}
            <div className="flex flex-col space-y-1 text-sm font-medium">
              <a
                href="/"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('home');
                    setMobileMenuOpen(false);
                  }
                }}
                className={`text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between min-h-[44px] ${
                  currentTab === 'home' ? 'bg-orange-50 text-[#FF7A00] font-bold' : 'text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <span>Home</span>
                <span className="text-zinc-400 text-xs">›</span>
              </a>

              <a
                href="/catalog"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('catalog');
                    setMobileMenuOpen(false);
                  }
                }}
                className={`text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between min-h-[44px] ${
                  currentTab === 'catalog' ? 'bg-orange-50 text-[#FF7A00] font-bold' : 'text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>Shop by Category</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">NEW</span>
                </div>
                <span className="text-zinc-400 text-xs">›</span>
              </a>

              <button
                onClick={() => { onNavigate('customizer'); setMobileMenuOpen(false); }}
                className="text-left px-3.5 py-3 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00] font-bold flex items-center justify-between min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <span>Customize With Your Logo</span>
                  <span className="text-[9px] bg-[#FF7A00] text-white font-bold px-1.5 py-0.5 rounded-full">POPULAR</span>
                </div>
                <span className="text-[#FF7A00] text-xs">›</span>
              </button>

              <a
                href="/bulk"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigate('bulk');
                    setMobileMenuOpen(false);
                  }
                }}
                className={`text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between min-h-[44px] ${
                  currentTab === 'bulk' ? 'bg-orange-50 text-[#FF7A00] font-bold' : 'text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <span>Bulk Orders / B2B RFQ</span>
                <span className="text-zinc-400 text-xs">›</span>
              </a>

              {onOpenQuoteCalculator && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenQuoteCalculator();
                  }}
                  className="text-left px-3.5 py-3 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center justify-between min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    <span>B2B Quote Calculator</span>
                    <span className="text-[9px] bg-[#FF7A00] text-white font-bold px-1.5 py-0.5 rounded-full">CALC</span>
                  </div>
                  <span className="text-zinc-400 text-xs">›</span>
                </button>
              )}

              {onOpenBundleBuilder && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenBundleBuilder();
                  }}
                  className="text-left px-3.5 py-3 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center justify-between min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    <span>Corporate Gift Bundles</span>
                    <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-full">NEW</span>
                  </div>
                  <span className="text-zinc-400 text-xs">›</span>
                </button>
              )}

              {onOpenDownloadCatalog && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDownloadCatalog();
                  }}
                  className="text-left px-3.5 py-3 rounded-xl text-zinc-800 hover:bg-zinc-100 transition-colors flex items-center justify-between min-h-[44px]"
                >
                  <span>Download Catalogues PDF</span>
                  <span className="text-zinc-400 text-xs">›</span>
                </button>
              )}

              {onOpenAppointment && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAppointment();
                  }}
                  className="text-left px-3.5 py-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 text-[#FF7A00] font-bold flex items-center justify-between min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    <span>📅 Book 1-on-1 Appointment</span>
                    <span className="text-[9px] bg-[#FF7A00] text-white font-bold px-1.5 py-0.5 rounded-full">FREE</span>
                  </div>
                  <span className="text-[#FF7A00] text-xs">›</span>
                </button>
              )}

              {onOpenWishlist && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenWishlist();
                  }}
                  className="text-left px-3.5 py-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 text-zinc-900 font-semibold flex items-center justify-between min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Heart className={`w-4 h-4 ${wishlistCount > 0 ? 'fill-rose-500 text-rose-500' : 'text-zinc-700'}`} />
                    <span>My Wishlist</span>
                  </div>
                  <span className="text-[10px] bg-[#0B0B0D] text-white px-2 py-0.5 rounded-full font-mono font-bold tabular-nums">
                    {wishlistCount}
                  </span>
                </button>
              )}

              {onOpenDeliveryCheck && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenDeliveryCheck();
                  }}
                  className="text-left px-3.5 py-3 rounded-xl bg-zinc-50 hover:bg-orange-50 border border-zinc-200/80 text-zinc-900 font-semibold flex items-center justify-between min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className={`w-4 h-4 shrink-0 ${savedDelivery?.serviceable ? 'text-emerald-600' : 'text-[#FF7A00]'}`} />
                    <span className="truncate">
                      {savedDelivery?.serviceable
                        ? `Delhivery Available (${savedDelivery.pincode})`
                        : 'Check Delhivery Area'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#FF7A00] font-semibold shrink-0 ml-2">
                    {savedDelivery?.serviceable ? 'Change' : 'Check PIN'}
                  </span>
                </button>
              )}

              <button
                onClick={() => { onNavigate('orders'); setMobileMenuOpen(false); }}
                className={`text-left px-3.5 py-3 rounded-xl transition-colors flex items-center justify-between min-h-[44px] ${
                  currentTab === 'orders' ? 'bg-orange-50 text-[#FF7A00] font-bold' : 'text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <span>Track Order & Proofs</span>
                <span className="text-zinc-400 text-xs">›</span>
              </button>

              <button
                onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }}
                className="text-left px-3.5 py-3 rounded-xl bg-zinc-100 text-zinc-900 font-semibold flex items-center justify-between min-h-[44px]"
              >
                <span>Corporate Dashboard & Invoices</span>
                {user ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
                    LOGGED IN
                  </span>
                ) : (
                  <span className="text-[10px] text-[#FF7A00] font-semibold">SIGN IN</span>
                )}
              </button>
            </div>

            {/* Direct Contact CTAs for Mobile */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col gap-2.5">
              <a
                href={getWhatsAppLink('Hi TeqqnoWorld, I want to request an instant quote for custom merchandise.')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#1EBE5D] hover:bg-[#19a851] text-white py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors min-h-[44px]"
              >
                <WhatsAppIcon className="w-4 h-4 text-white" />
                <span>WhatsApp Quote ({BUSINESS_CONFIG.contact.whatsapp})</span>
              </a>
              <a
                href={BUSINESS_CONFIG.contact.telLink}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
              >
                <span>Call Factory Print Desk: {BUSINESS_CONFIG.contact.phone}</span>
              </a>
            </div>

            {/* Follow TeqqnoWorld Social Strip (Mobile Drawer) */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Follow Us
              </span>
              <div className="flex items-center gap-2">
                {SOCIAL_CHANNELS.map(({ id, label, href, Icon, restColorClass, hoverClass }) => (
                  <a
                    key={id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow TeqqnoWorld on ${label}`}
                    title={label}
                    className={`w-9 h-9 rounded-full bg-zinc-50 border border-zinc-200/90 shadow-2xs flex items-center justify-center transition-all duration-200 ${restColorClass} ${hoverClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};
