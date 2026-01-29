// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Upload, AlertTriangle, Loader2, Copy, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';
import { validateNsec, validateBunkerUri } from '@/lib/security';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup?: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ isOpen, onClose, onLogin, onSignup }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const [bunkerUri, setBunkerUri] = useState('');
  const [nostrConnectParams, setNostrConnectParams] = useState<NostrConnectParams | null>(null);
  const [nostrConnectUri, setNostrConnectUri] = useState<string>('');
  const [isWaitingForConnect, setIsWaitingForConnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showBunkerInput, setShowBunkerInput] = useState(false);
  const [errors, setErrors] = useState<{
    nsec?: string;
    bunker?: string;
    file?: string;
    extension?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const login = useLoginActions();

  // Check if on mobile device
  const isMobile = useIsMobile();
  // Check if extension is available
  const hasExtension = 'nostr' in window;

  // Generate nostrconnect params (sync) - just creates the QR code data
  const generateConnectSession = useCallback(() => {
    const relayUrls = login.getRelayUrls();
    const params = generateNostrConnectParams(relayUrls);
    const uri = generateNostrConnectURI(params, 'TravelTelly');
    setNostrConnectParams(params);
    setNostrConnectUri(uri);
    setConnectError(null);
  }, [login]);

  // Start listening for connection (async) - runs after params are set
  useEffect(() => {
    if (!nostrConnectParams || isWaitingForConnect) return;

    const startListening = async () => {
      setIsWaitingForConnect(true);
      abortControllerRef.current = new AbortController();

      try {
        await login.nostrconnect(nostrConnectParams);
        onLogin();
        onClose();
      } catch (error) {
        console.error('Nostrconnect failed:', error);
        setConnectError(error instanceof Error ? error.message : 'Connection failed');
        setIsWaitingForConnect(false);
      }
    };

    startListening();
  }, [nostrConnectParams, login, onLogin, onClose, isWaitingForConnect]);

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setIsLoading(false);
      setIsFileLoading(false);
      setNsec('');
      setBunkerUri('');
      setNostrConnectParams(null);
      setNostrConnectUri('');
      setIsWaitingForConnect(false);
      setConnectError(null);
      setShowBunkerInput(false);
      setErrors({});
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Retry connection with new params
  const handleRetry = useCallback(() => {
    setNostrConnectParams(null);
    setNostrConnectUri('');
    setIsWaitingForConnect(false);
    setConnectError(null);
    // Generate new session after state clears
    setTimeout(() => generateConnectSession(), 0);
  }, [generateConnectSession]);

  const handleCopyUri = async () => {
    await navigator.clipboard.writeText(nostrConnectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open the nostrconnect URI in the system - this will launch a signer app like Amber if installed
  const handleOpenSignerApp = () => {
    if (!nostrConnectUri) return;
    // On mobile, this will trigger the system to find an app that handles nostrconnect:// URIs
    window.location.href = nostrConnectUri;
  };

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setErrors(prev => ({ ...prev, extension: undefined }));
    
    try {
      if (!('nostr' in window)) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.');
      }
      await login.extension();
      onLogin();
      onClose();
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        extension: error instanceof Error ? error.message : 'Extension login failed'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyLogin = () => {
    if (!nsec.trim()) {
      setErrors(prev => ({ ...prev, nsec: 'Please enter your nsec key' }));
      return;
    }
    
    if (!validateNsec(nsec)) {
      setErrors(prev => ({ ...prev, nsec: 'Invalid nsec format. Must start with nsec1' }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, nsec: undefined }));
    
    try {
      login.nsec(nsec);
      onLogin();
      onClose();
      // Clear the key from memory
      setNsec('');
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        nsec: 'Login failed. Please check your key.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = async () => {
    if (!bunkerUri.trim()) {
      setErrors(prev => ({ ...prev, bunker: 'Please enter a bunker URI' }));
      return;
    }
    
    if (!validateBunkerUri(bunkerUri)) {
      setErrors(prev => ({ ...prev, bunker: 'Invalid bunker URI format. Must start with bunker://' }));
      return;
    }

    setIsLoading(true);
    setErrors(prev => ({ ...prev, bunker: undefined }));
    
    try {
      await login.bunker(bunkerUri);
      onLogin();
      onClose();
      // Clear the URI from memory
      setBunkerUri('');
    } catch (error) {
      setErrors(prev => ({ 
        ...prev, 
        bunker: 'Failed to connect to bunker. Please check the URI.'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileLoading(true);
    setErrors(prev => ({ ...prev, file: undefined }));

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const trimmedContent = content.trim();
        if (validateNsec(trimmedContent)) {
          setNsec(trimmedContent);
        } else {
          setErrors(prev => ({ ...prev, file: 'File does not contain a valid nsec key' }));
        }
      } else {
        setErrors(prev => ({ ...prev, file: 'Could not read file' }));
      }
      setIsFileLoading(false);
    };
    reader.onerror = () => {
      setErrors(prev => ({ ...prev, file: 'Failed to read file' }));
      setIsFileLoading(false);
    };
    reader.readAsText(file);
  };

  const handleSignupClick = () => {
    onClose();
    if (onSignup) {
      onSignup();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md p-0 overflow-hidden rounded-2xl'>
        <DialogHeader className='px-6 pt-6 pb-1 relative'>
          <DialogTitle className='font-semibold text-center'>Log in</DialogTitle>
          <DialogDescription className='text-center'>
            Access your account securely with your preferred method
          </DialogDescription>
        </DialogHeader>
        
        <div className='px-6 pt-2 pb-4 space-y-4 overflow-y-auto flex-1 max-h-[70vh]'>
          {/* Login Methods */}
          <Tabs 
            defaultValue={hasExtension ? 'extension' : 'key'}
            onValueChange={(value) => {
              if (value === 'connect' && !nostrConnectParams && !connectError) {
                generateConnectSession();
              }
            }}
            className="w-full"
          >
            <TabsList className='grid w-full grid-cols-3 mb-4'>
              <TabsTrigger value='extension'>Extension</TabsTrigger>
              <TabsTrigger value='key'>Nsec</TabsTrigger>
              <TabsTrigger value='connect'>Connect</TabsTrigger>
            </TabsList>

            <TabsContent value='extension' className='space-y-3'>
              {errors.extension && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errors.extension}</AlertDescription>
                </Alert>
              )}
              <div className='text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800'>
                <Shield className='w-12 h-12 mx-auto mb-3 text-primary' />
                <p className='text-sm text-gray-600 dark:text-gray-300 mb-4'>
                  Login with one click using the browser extension
                </p>
                <div className="flex justify-center">
                  <Button
                    className='w-full rounded-full py-4'
                    onClick={handleExtensionLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Logging in...' : 'Login with Extension'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value='connect' className='space-y-4'>
              {/* Nostrconnect Section */}
              <div className='flex flex-col items-center space-y-4'>
                {connectError ? (
                  <div className='flex flex-col items-center space-y-4 py-4'>
                    <p className='text-sm text-red-500 text-center'>{connectError}</p>
                    <Button variant='outline' onClick={handleRetry}>
                      Try Again
                    </Button>
                  </div>
                ) : nostrConnectUri ? (
                  <>
                    {/* QR Code - only show on desktop */}
                    {!isMobile && (
                      <div className='p-4 bg-white dark:bg-white rounded-xl'>
                        <QRCodeCanvas
                          value={nostrConnectUri}
                          size={180}
                          level='M'
                        />
                      </div>
                    )}

                    {/* Status message */}
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                      {isWaitingForConnect ? (
                        <>
                          <Loader2 className='w-4 h-4 animate-spin' />
                          <span>Waiting for connection...</span>
                        </>
                      ) : (
                        <span>{isMobile ? 'Tap to open your signer app' : 'Scan with your signer app'}</span>
                      )}
                    </div>

                    {/* Open Signer App button - primary action on mobile */}
                    {isMobile && (
                      <Button
                        className='w-full gap-2 py-6 rounded-full'
                        onClick={handleOpenSignerApp}
                      >
                        <ExternalLink className='w-5 h-5' />
                        Open Signer App
                      </Button>
                    )}

                    {/* Copy button */}
                    <Button
                      variant='outline'
                      size={isMobile ? 'default' : 'sm'}
                      className={isMobile ? 'w-full gap-2 rounded-full' : 'gap-2'}
                      onClick={handleCopyUri}
                    >
                      {copied ? (
                        <>
                          <Check className='w-4 h-4' />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className='w-4 h-4' />
                          Copy Connection URI
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className='flex items-center justify-center h-[100px]'>
                    <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
                  </div>
                )}
              </div>

              {/* Manual URI input section - collapsible */}
              <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
                <button
                  type='button'
                  onClick={() => setShowBunkerInput(!showBunkerInput)}
                  className='flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2'
                >
                  <span>Manual bunker connection</span>
                  {showBunkerInput ? (
                    <ChevronUp className='w-4 h-4' />
                  ) : (
                    <ChevronDown className='w-4 h-4' />
                  )}
                </button>

                {showBunkerInput && (
                  <div className='space-y-3 mt-3'>
                    <div className='space-y-2'>
                      <Input
                        id='connectBunkerUri'
                        value={bunkerUri}
                        onChange={(e) => setBunkerUri(e.target.value)}
                        className='rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-primary text-sm'
                        placeholder='bunker://'
                      />
                      {bunkerUri && !validateBunkerUri(bunkerUri) && (
                        <p className='text-red-500 text-xs'>Invalid bunker URI format. Must start with bunker://</p>
                      )}
                    </div>

                    <Button
                      className='w-full rounded-full py-4'
                      variant='outline'
                      onClick={handleBunkerLogin}
                      disabled={isLoading || !bunkerUri.trim() || !validateBunkerUri(bunkerUri)}
                    >
                      {isLoading ? 'Connecting...' : 'Login with Bunker'}
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value='key' className='space-y-4'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <label htmlFor='nsec' className='text-sm font-medium'>
                    Private Key (nsec)
                  </label>
                  <Input
                    id='nsec'
                    type="password"
                    value={nsec}
                    onChange={(e) => {
                      setNsec(e.target.value);
                      if (errors.nsec) setErrors(prev => ({ ...prev, nsec: undefined }));
                    }}
                    className={`rounded-lg ${
                      errors.nsec ? 'border-red-500 focus-visible:ring-red-500' : ''
                    }`}
                    placeholder='nsec1...'
                    autoComplete="off"
                  />
                  {errors.nsec && (
                    <p className="text-sm text-red-500">{errors.nsec}</p>
                  )}
                </div>

                <Button
                  className='w-full rounded-full py-3'
                  onClick={handleKeyLogin}
                  disabled={isLoading || !nsec.trim()}
                >
                  {isLoading ? 'Verifying...' : 'Login with Nsec'}
                </Button>

                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-muted'></div>
                  </div>
                  <div className='relative flex justify-center text-xs'>
                    <span className='px-2 bg-background text-muted-foreground'>
                      or
                    </span>
                  </div>
                </div>

                <div className='text-center'>
                  <input
                    type='file'
                    accept='.txt'
                    className='hidden'
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant='outline'
                    className='w-full'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isFileLoading}
                  >
                    <Upload className='w-4 h-4 mr-2' />
                    {isFileLoading ? 'Reading file...' : 'Upload Nsec File'}
                  </Button>
                  {errors.file && (
                    <p className="text-sm text-red-500 mt-2">{errors.file}</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Sign Up Link */}
          {onSignup && (
            <div className='text-center text-sm pt-4 border-t'>
              <p className='text-gray-600 dark:text-gray-400'>
                Don't have an account?{' '}
                <button
                  onClick={handleSignupClick}
                  className='text-primary hover:underline font-medium'
                >
                  Sign up
                </button>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
