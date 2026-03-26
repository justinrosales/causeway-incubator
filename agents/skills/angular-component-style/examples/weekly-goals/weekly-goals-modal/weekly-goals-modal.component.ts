import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, WritableSignal, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogClose, MatDialogRef } from '@angular/material/dialog';
import { MatFormField } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { WeeklyGoal } from 'src/app/core/store/weekly-goal/weekly-goal.model';
import { endOfWeek, startOfWeek } from 'src/app/core/utils/time.utils';
import { QuarterlyGoalData, WeeklyGoalInForm } from '../../home.model';
import { WeeklyGoalsModalAnimations } from './weekly-goals-modal.animations';
import { LoadingIconComponent } from 'src/app/shared/components/loading-icon/loading-icon.component';

@Component({
  selector: 'app-weekly-goals-modal',
  templateUrl: './weekly-goals-modal.component.html',
  styleUrls: ['./weekly-goals-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: WeeklyGoalsModalAnimations,
  imports: [
    MatIconButton,
    MatDialogClose,
    MatIcon,
    FormsModule,
    ReactiveFormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MatFormField,
    MatInput,
    MatSelect,
    MatOption,
    MatTooltip,
    // component
    LoadingIconComponent,
  ],
})
export class WeeklyGoalsModalComponent {
  data = inject<{
    goalDatas: Partial<QuarterlyGoalData>[];
    incompleteGoals: WeeklyGoal[];
    pencilClicked: boolean;
    loading: WritableSignal<boolean>; // so the modal can know that status of loading/updates
    updateWeeklyGoals:(quarterGoalsFormArray: FormArray) => void;
  }>(MAT_DIALOG_DATA);
  dialogRef = inject<MatDialogRef<WeeklyGoalsModalComponent>>(MatDialogRef);
  private fb = inject(FormBuilder);

  // --------------- INPUTS AND OUTPUTS ------------------

  // --------------- LOCAL UI STATE ----------------------

  /** FormControls for editing past goals and adding a new one */
  weeklyGoalsForm = this.fb.group({
    allGoals: this.fb.array([
      this.fb.group({
        text: ['', Validators.required],
        originalText: [''],
        originalOrder: [1],
        __weeklyGoalId: [''],
        __quarterlyGoalId: [''], // changed from hashtagId
      }),
    ]),
  });
  /** Getter for the form array with a type that allows use of controls. */
  get allGoals() {
    return this.weeklyGoalsForm.get('allGoals') as FormArray;
  }

  /** Editable weekly goals form. */
  mutableWeekGoalsForm: WeeklyGoal[];

  /** Declare FormGroup for new goal */
  goalForm: FormGroup = new FormGroup({
    text: new FormControl(), // Assuming you have a control for the goal text
    __quarterlyGoalId: new FormControl(), // Assuming you have a control for the hashtag ID
  });

  // --------------- COMPUTED DATA -----------------------

  endOfWeek = endOfWeek; // import from time.utils.ts

  startOfWeek = startOfWeek; // import from time.utils.ts

  // --------------- EVENT HANDLING ----------------------
  /** Add a goal to the form. */
  addGoalToForm(goal: WeeklyGoalInForm) {
    if (goal) {
      this.allGoals.push(this.fb.group({
        text: [goal.text, Validators.required],
        originalText: [goal.text],
        originalOrder: [goal.originalOrder],
        originalQuarterlyGoalId: [goal.__quarterlyGoalId],
        __weeklyGoalId: [goal.__weeklyGoalId],
        __quarterlyGoalId: [goal.__quarterlyGoalId, Validators.required],
        _deleted: [false],
        _new: [false],
      }));
    } else {
      this.allGoals.push(this.fb.group({
        text: ['', Validators.required],
        __quarterlyGoalId: ['', Validators.required],
        _deleted: [false],
        _new: [true],
      }));
    }
  }

  /** Save any updates for any of the goals. */
  async saveGoals() {
    await this.data.updateWeeklyGoals(this.allGoals);
  }

  /** Support drag and drop of goals. */
  drop(event: CdkDragDrop<WeeklyGoal[]>) {
    moveItemInArray(this.allGoals.controls, event.previousIndex, event.currentIndex);
  }

  /** Deletes goal from form if user just created the goal but hasn't saved it */
  fullDelete(e, i) {
    if (e.target.checked && this.weeklyGoalsForm.get(['allGoals', i, '_new']).value ) {
      this.allGoals.removeAt(i);
    }
  }

  /**
   * Get the count of newly added goals that are not marked for deletion.
   * A goal is considered newly added if its `_new` flag is true.
   */
  get addedGoalsCount() {
    // Filter the goals to find those that are newly added (_new is true) and not marked as deleted (_deleted is false)
    return this.allGoals.controls.filter((goal) => goal.value._new && !goal.value._deleted).length;
  }

  /**
   * Returns the number of goals that were actually edited.
   *
   * A goal counts as edited if:
   * - it is dirty,
   * - its text or quarterlyGoalId differs from the original,
   * - it is not newly added (`_new === false`),
   * - it is not marked for deletion (`_deleted === false`).
   */
  get editedGoalsCount() {
    return this.allGoals.controls.filter((goal) =>
      goal.dirty &&
      (goal.value.text !== goal.value.originalText ||
      goal.value.originalQuarterlyGoalId !== goal.value.__quarterlyGoalId) &&
      !goal.value._new &&
      !goal.value._deleted).length;
  }

  /**
   * Get the count of goals that are marked for deletion.
   * A goal is considered marked for deletion if its `_deleted` flag is true.
   */
  get deletedGoalsCount() {
    // Filter the goals to find those that are marked as deleted (_deleted is true)
    return this.allGoals.controls.filter((goal) => goal.value._deleted).length;
  }


  // --------------- OTHER -------------------------------

  constructor() {
    // Initialize the quarterGoalsForm with the set of incompleteGoals
    this.allGoals.clear();
    if (this.data.incompleteGoals.length !== 0) {
      this.data.incompleteGoals.forEach((goal) => {
        this.addGoalToForm({
          text: goal.text,
          __quarterlyGoalId: goal.__quarterlyGoalId,
          originalText: goal.text,
          originalOrder: goal.order,
          originalQuarterlyGoalId: goal. __quarterlyGoalId,
          __weeklyGoalId: goal.__id,
          _deleted: goal._deleted,
          _new: false,
        });
      });
    }
    if (!this.data.pencilClicked || this.data.incompleteGoals.length === 0) {
      this.addGoalToForm(null);
    }
  }
}
