import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";

type Props = {
  deleteid: number | string;
  onDelete: (id: number) => void;
  label?: string;
};

export const RemoveButton = ({ deleteid, onDelete, label = "Delete" }: Props) => {
  const numericId = Number(deleteid);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          aria-label={`Delete time report ${String(deleteid)}`}
        >
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this time report?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Do you want to continue?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" aria-label="Cancel deletion">
              No
            </Button>
          </DialogClose>

          <DialogClose asChild>
            <Button
              variant="destructive"
              onClick={() => {
                if (Number.isFinite(numericId)) onDelete(numericId);
              }}
              aria-label="Confirm deletion"
            >
              Yes, remove
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
