import { useState, useEffect, useCallback } from 'react';

type ValidationRule<T> = {
  validator: (value: T) => boolean;
  message: string;
};

type ValidationRules<T> = {
  [K in keyof T]?: Array<ValidationRule<T[K]>>;
};

type FormErrors<T> = {
  [K in keyof T]?: string;
};

interface UseFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validate?: (values: T) => FormErrors<T>;
  validationRules?: ValidationRules<T>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  onSubmit,
  validate,
  validationRules,
  onSuccess,
  onError,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<Record<keyof T, boolean>>(
    () => ({} as Record<keyof T, boolean>)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Validate using provided validation rules
  const validateWithRules = useCallback((
    values: T,
    rules: ValidationRules<T>
  ): FormErrors<T> => {
    const newErrors: FormErrors<T> = {};

    (Object.keys(rules) as Array<keyof T>).forEach((field) => {
      const fieldRules = rules[field] || [];
      
      for (const rule of fieldRules) {
        if (!rule.validator(values[field])) {
          newErrors[field] = rule.message;
          break;
        }
      }
    });

    return newErrors;
  }, []);

  // Run validation when values or validation rules change
  useEffect(() => {
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
    } else if (validationRules) {
      const newErrors = validateWithRules(values, validationRules);
      setErrors(newErrors);
    }
  }, [values, validate, validationRules, validateWithRules]);

  // Check if form is valid
  const isValid = useCallback((): boolean => {
    if (validate) {
      return Object.keys(validate(values)).length === 0;
    }
    if (validationRules) {
      return Object.keys(validateWithRules(values, validationRules)).length === 0;
    }
    return true;
  }, [values, validate, validationRules, validateWithRules]);

  // Handle input change
  const handleChange = <K extends keyof T>(
    field: K,
    value: T[K] | ((prev: T[K]) => T[K])
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: typeof value === 'function' ? (value as (prev: T[K]) => T[K])(prev[field]) : value,
    }));
  };

  // Handle blur event
  const handleBlur = <K extends keyof T>(field: K) => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  // Set field value
  const setFieldValue = <K extends keyof T>(field: K, value: T[K]) => {
    handleChange(field, value);
  };

  // Set field touched
  const setFieldTouched = <K extends keyof T>(field: K, isTouched: boolean = true) => {
    setTouched((prev) => ({
      ...prev,
      [field]: isTouched,
    }));
  };

  // Set field error
  const setFieldError = <K extends keyof T>(field: K, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  };

  // Reset form
  const resetForm = (newValues: T = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({} as Record<keyof T, boolean>);
    setSubmitCount(0);
  };

  // Submit handler
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof T] = true;
      return acc;
    }, {} as Record<keyof T, boolean>);
    
    setTouched(allTouched);
    setSubmitCount((prev) => prev + 1);

    // Validate form
    let formErrors: FormErrors<T> = {};
    
    if (validate) {
      formErrors = validate(values);
    } else if (validationRules) {
      formErrors = validateWithRules(values, validationRules);
    }
    
    setErrors(formErrors);

    // If no errors, submit the form
    if (Object.keys(formErrors).length === 0) {
      try {
        setIsSubmitting(true);
        await onSubmit(values);
        onSuccess?.();
      } catch (error) {
        console.error('Form submission error:', error);
        onError?.(error as Error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Get field props
  const getFieldProps = <K extends keyof T>(field: K) => ({
    name: field as string,
    value: values[field],
    onChange: (value: T[K] | ((prev: T[K]) => T[K])) => handleChange(field, value),
    onBlur: () => handleBlur(field),
    error: touched[field] ? errors[field] : undefined,
  });

  return {
    values,
    errors,
    touched,
    isSubmitting,
    submitCount,
    isValid: isValid(),
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    setErrors,
    setValues,
    resetForm,
    getFieldProps,
  };
}

// Common validation rules
export const required = (message: string = 'This field is required') => ({
  validator: (value: unknown) => {
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== undefined && value !== null && value !== '';
  },
  message,
});

export const minLength = (min: number, message: string) => ({
  validator: (value: string) => value.length >= min,
  message: message || `Must be at least ${min} characters`,
});

export const maxLength = (max: number, message: string) => ({
  validator: (value: string) => value.length <= max,
  message: message || `Must be at most ${max} characters`,
});

export const email = (message: string = 'Please enter a valid email') => ({
  validator: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  message,
});

export const match = (field: string, message: string) => ({
  validator: (value: unknown, allValues: Record<string, unknown>) => value === allValues[field],
  message,
});

export const pattern = (regex: RegExp, message: string) => ({
  validator: (value: string) => regex.test(value),
  message,
});

export const composeValidators = <T>(
  ...validators: Array<ValidationRule<T>>
) => (value: T) => {
  for (const validator of validators) {
    if (!validator.validator(value)) {
      return validator.message;
    }
  }
  return undefined;
};
