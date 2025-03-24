import { ReactNode, useState } from "react";
import { toast } from "react-hot-toast";

interface TransactionButtonProps {
  onClick: () => Promise<any>;
  children: ReactNode;
  className?: string;
  loadingText?: string;
  successText?: string;
  errorText?: string;
}

export function TransactionButton({
  onClick,
  children,
  className = "",
  loadingText = "Processing...",
  successText = "Transaction successful!",
  errorText = "Transaction failed",
}: TransactionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    try {
      setLoading(true);
      const result = await onClick();
      
      if (result?.success) {
        toast.success(successText);
      } else if (result?.message) {
        toast.error(result.message);
      }
      
      return result;
    } catch (error) {
      console.error("Transaction error:", error);
      toast.error(errorText);
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  const defaultClassName = `
    px-4 py-2 rounded-lg 
    transition-all duration-200 
    disabled:opacity-50 disabled:cursor-not-allowed
    ${loading ? "bg-gray-700" : "bg-gradient-to-r from-cora-primary to-cora-secondary"}
  `;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className || defaultClassName}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
          {loadingText}
        </div>
      ) : (
        children
      )}
    </button>
  );
} 