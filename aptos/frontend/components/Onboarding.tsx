import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  fields: {
    id: string;
    label: string;
    type: string;
    options?: string[];
    required: boolean;
    tooltip?: string;
  }[];
};

const onboardingSteps: OnboardingStep[] = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Please provide your basic personal information",
    fields: [
      { id: "name", label: "Full Name", type: "text", required: true },
      { id: "age", label: "Age", type: "number", required: true, tooltip: "Your age is a primary factor in determining premium rates" },
      { 
        id: "gender", 
        label: "Gender", 
        type: "select", 
        options: ["Male", "Female", "Other", "Prefer not to say"],
        required: true,
        tooltip: "Women generally have longer life expectancy, which may result in lower premiums"
      },
      { id: "email", label: "Email", type: "email", required: true },
      { id: "phone", label: "Phone Number", type: "tel", required: true },
      {
        id: "maritalStatus",
        label: "Marital Status",
        type: "select",
        options: ["Single", "Married", "Divorced", "Widowed"],
        required: true
      },
    ],
  },
  {
    id: "health",
    title: "Health Information",
    description: "Please provide your health information",
    fields: [
      { 
        id: "height", 
        label: "Height (in cm)", 
        type: "number", 
        required: true 
      },
      { 
        id: "weight", 
        label: "Weight (in kg)", 
        type: "number", 
        required: true 
      },
      { 
        id: "smoker", 
        label: "Do you smoke?", 
        type: "select", 
        options: ["Yes", "No"],
        required: true,
        tooltip: "Smoking significantly increases premiums due to higher health risks"
      },
      { 
        id: "alcoholConsumption", 
        label: "Alcohol Consumption", 
        type: "select", 
        options: ["None", "Occasional", "Regular", "Heavy"],
        required: true,
        tooltip: "Regular alcohol consumption may affect your premium rates"
      },
      { 
        id: "preExistingConditions", 
        label: "Do you have any pre-existing medical conditions?", 
        type: "select", 
        options: ["Yes", "No"],
        required: true,
        tooltip: "Pre-existing conditions may increase premium rates or affect eligibility"
      },
      { 
        id: "familyHistory", 
        label: "Family history of serious illnesses", 
        type: "select", 
        options: ["Yes", "No"],
        required: true,
        tooltip: "Family history of certain conditions may affect risk assessment"
      },
    ],
  },
  {
    id: "lifestyle",
    title: "Lifestyle Information",
    description: "Please provide information about your lifestyle",
    fields: [
      { 
        id: "occupation", 
        label: "Occupation", 
        type: "select", 
        options: [
          "Salaried",
          "Self-employed",
          "Business Owner",
          "Freelancer",
          "Student",
          "Retired",
          "Other"
        ],
        required: true,
        tooltip: "Certain occupations involve higher risks and may affect premiums"
      },
      {
        id: "riskyHobbies",
        label: "Do you engage in risky hobbies?",
        type: "select",
        options: ["Yes", "No"],
        required: true,
        tooltip: "Activities like skydiving, racing, or mountaineering may increase premiums"
      },
      {
        id: "exerciseFrequency",
        label: "Exercise Frequency",
        type: "select",
        options: ["None", "1-2 times/week", "3-4 times/week", "5+ times/week"],
        required: true
      },
      { 
        id: "income", 
        label: "Annual Income (in INR)", 
        type: "select", 
        options: [
          "Less than ₹5,00,000",
          "₹5,00,000 - ₹10,00,000",
          "₹10,00,000 - ₹15,00,000",
          "₹15,00,000 - ₹25,00,000",
          "More than ₹25,00,000"
        ],
        required: true,
        tooltip: "Income helps determine appropriate coverage amounts"
      },
    ],
  },
  {
    id: "coverage",
    title: "Coverage Preferences",
    description: "Please provide your insurance coverage preferences",
    fields: [
      {
        id: "coverageAmount",
        label: "Desired Coverage Amount",
        type: "select",
        options: [
          "₹10,00,000",
          "₹25,00,000",
          "₹50,00,000",
          "₹1,00,00,000",
          "₹2,00,00,000",
          "Other"
        ],
        required: true,
        tooltip: "Higher coverage amounts result in higher premiums"
      },
      {
        id: "policyTerm",
        label: "Policy Term (years)",
        type: "select",
        options: ["5", "10", "15", "20", "25", "30"],
        required: true,
        tooltip: "Longer policy terms typically result in higher premiums"
      },
      {
        id: "paymentFrequency",
        label: "Premium Payment Frequency",
        type: "select",
        options: ["Monthly", "Quarterly", "Semi-annually", "Annually"],
        required: true
      },
      {
        id: "riders",
        label: "Additional Riders",
        type: "select",
        options: [
          "Critical Illness Cover",
          "Accidental Death Benefit",
          "Disability Cover",
          "Waiver of Premium",
          "None"
        ],
        required: true,
        tooltip: "Adding riders will increase your premium but provide additional benefits"
      }
    ]
  }
];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const navigate = useNavigate();
  const { account } = useWallet();

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleNext = () => {
    // Validate current step
    const currentStepData = onboardingSteps[currentStep];
    const requiredFields = currentStepData.fields.filter(field => field.required);
    
    const isValid = requiredFields.every(field => 
      formData[field.id] && formData[field.id].trim() !== ""
    );
    
    if (!isValid) {
      alert("Please fill in all required fields");
      return;
    }
    
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    } else {
      // Submit the form data
      console.log("Form data submitted:", {
        ...formData,
        walletAddress: account?.address,
      });
      
      // Navigate to dashboard
      navigate("/dashboard");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const toggleTooltip = (fieldId: string | null) => {
    setShowTooltip(fieldId);
  };

  const currentStepData = onboardingSteps[currentStep];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-neue font-bold gradient_text_2">
              {currentStepData.title}
            </h2>
            <div className="text-sm text-gray-400">
              Step {currentStep + 1} of {onboardingSteps.length}
            </div>
          </div>
          <p className="text-gray-300 mb-6">{currentStepData.description}</p>
          
          <div className="w-full bg-gray-800 h-2 rounded-full mb-8">
            <div 
              className="bg-cora-primary h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 md:p-8 border border-white/10 mb-8">
          <div className="space-y-6">
            {currentStepData.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center">
                  <label htmlFor={field.id} className="block text-sm font-medium text-gray-200">
                    {field.label} {field.required && <span className="text-cora-primary">*</span>}
                  </label>
                  
                  {field.tooltip && (
                    <div className="relative ml-2">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-300"
                        onMouseEnter={() => toggleTooltip(field.id)}
                        onMouseLeave={() => toggleTooltip(null)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {showTooltip === field.id && (
                        <div className="absolute z-10 w-64 p-2 mt-1 text-sm text-white bg-gray-900 rounded-md shadow-lg border border-gray-700">
                          {field.tooltip}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {field.type === "select" ? (
                  <select
                    id={field.id}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-cora-primary focus:border-cora-primary"
                    required={field.required}
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    id={field.id}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-cora-primary focus:border-cora-primary"
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`px-6 py-3 rounded-lg border border-white/10 ${
              currentStep === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-800"
            }`}
          >
            Back
          </button>
          
          <button
            onClick={handleNext}
            className="group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10 px-6 py-3 text-white rounded-lg transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px shadow-2xl hover:scale-105 bg-cora-primary"
          >
            {currentStep === onboardingSteps.length - 1 ? "Complete" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
} 