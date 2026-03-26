import { NgOptimizedImage } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, OnInit, Signal, WritableSignal, computed, inject, signal, output } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthStore } from 'src/app/core/store/auth/auth.store';
import { BatchWriteService, BATCH_WRITE_SERVICE } from 'src/app/core/store/batch-write.service';
import { HashtagStore, LoadHashtag } from 'src/app/core/store/hashtag/hashtag.store';
import { LoadQuarterlyGoal, QuarterlyGoalStore } from 'src/app/core/store/quarterly-goal/quarterly-goal.store';
import { User } from 'src/app/core/store/user/user.model';
import { WeeklyGoal } from 'src/app/core/store/weekly-goal/weekly-goal.model';
import { WeeklyGoalStore } from 'src/app/core/store/weekly-goal/weekly-goal.store';
import { endOfWeek, getStartWeekDate, startOfWeek } from 'src/app/core/utils/time.utils';
import { QuarterlyGoalData, WeeklyGoalData } from '../home.model';
import { WeeklyGoalItemComponent } from './weekly-goal-item/weekly-goal-item.component';
import { WeeklyGoalsModalComponent } from './weekly-goals-modal/weekly-goals-modal.component';
import { WeeklyGoalsAnimations } from './weekly-goals.animations';
import { SkeletonCardComponent } from 'src/app/shared/components/skeleton-card/skeleton-card.component';
import { QuarterlyGoal } from 'src/app/core/store/quarterly-goal/quarterly-goal.model';

@Component({
  selector: 'app-weekly-goals',
  templateUrl: './weekly-goals.component.html',
  styleUrls: ['./weekly-goals.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [WeeklyGoalsAnimations],
  imports: [
    NgOptimizedImage,
    MatButton,
    // component
    WeeklyGoalItemComponent,
    SkeletonCardComponent,
  ],
})
export class WeeklyGoalsComponent implements OnInit, AfterViewInit {
  readonly authStore = inject(AuthStore);
  readonly hashtagStore = inject(HashtagStore);
  readonly weeklyGoalStore = inject(WeeklyGoalStore);
  readonly quarterlyGoalStore = inject(QuarterlyGoalStore);
  private dialog = inject(MatDialog);
  private batch = inject<BatchWriteService>(BATCH_WRITE_SERVICE);
  // --------------- INPUTS AND OUTPUTS ------------------

  /** The current signed in user. */
  currentUser: Signal<User> = this.authStore.user;

  /** Handles if a weekly goal is clicked */
  goalClicked = output<QuarterlyGoal>();

  /** Data for completed weekly goals. */
  completeWeeklyGoals: Signal<WeeklyGoalData[]> = computed(() => {
    const startOfWeek = getStartWeekDate();
    const completeGoals = this.weeklyGoalStore.selectEntities([
      ['__userId', '==', this.currentUser().__id],
      ['completed', '==', true],
      ['endDate', '>=', Timestamp.fromDate(startOfWeek)],
    ], { orderBy: 'order' });

    return completeGoals.map((goal) => {
      // get the quarter goal associated with that weekly goal to make updates easier
      const quarterGoal = this.quarterlyGoalStore.selectEntity(goal.__quarterlyGoalId);
      return Object.assign({}, goal, {
        hashtag: this.hashtagStore.selectEntity(quarterGoal?.__hashtagId),
        quarterGoal: quarterGoal,
      });
    });
  });

  /** Data for incomplete weekly goals. */
  incompleteWeeklyGoals: Signal<WeeklyGoalData[]> = computed(() => {
    const incompleteGoals = this.weeklyGoalStore.selectEntities([
      ['__userId', '==', this.currentUser().__id],
      ['completed', '==', false],
    ], { orderBy: 'order' });

    return incompleteGoals.map((goal) => {
      // get the quarter goal associated with that weekly goal to make updates easier
      const quarterGoal = this.quarterlyGoalStore.selectEntity(goal.__quarterlyGoalId);
      return Object.assign({}, goal, {
        hashtag: this.hashtagStore.selectEntity(quarterGoal?.__hashtagId),
        quarterGoal: quarterGoal,
      });
    });
  });

  /** All quarterly goals, needed for weekly goals modal */
  allQuarterlyGoals: Signal<Partial<QuarterlyGoalData>[]> = computed(() => {
    const allGoals = this.quarterlyGoalStore.selectEntities([
      ['__userId', '==', this.currentUser().__id],
    ], { orderBy: 'order' });

    return allGoals.map((goal) => {
      return Object.assign({}, goal, {
        hashtag: this.hashtagStore.selectEntity(goal.__hashtagId),
      });
    });
  });

  // --------------- LOCAL UI STATE ----------------------

  /** Loading icon. */
  loading: WritableSignal<boolean> = signal(false);

  /** For storing the dialogRef in the opened modal. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dialogRef: MatDialogRef<any>;

  /** Disable animation on initial view / page load : Angular
   * https://stackoverflow.com/questions/49012602/angular-disable-animation-on-initial-view-page-load
  */
  animationDisabled = true;

  // --------------- COMPUTED DATA -----------------------

  endOfWeek = endOfWeek; // import from time.utils.ts

  startOfWeek = startOfWeek; // import from time.utils.ts

  // --------------- EVENT HANDLING ----------------------

  /** Open add or edit goals modal for weekly goals. */
  openModal(pencilClicked: boolean) {
    this.dialogRef = this.dialog.open(WeeklyGoalsModalComponent, {
      height: '90%',
      position: { bottom: '0' },
      data: {
        goalDatas: this.allQuarterlyGoals(),
        incompleteGoals: this.incompleteWeeklyGoals(),
        loading: this.loading,
        pencilClicked,
        updateWeeklyGoals: async (weekGoalsFormArray) => {
          try {
            await this.batch.batchWrite(async (batchConfig) => {
              await Promise.all(weekGoalsFormArray.controls.map(async (control, i) => {
              // if this is a new weekly goal
                if (!control.value.__weeklyGoalId) {
                  await this.addNewGoal(control.value, i, batchConfig);
                // if it's a goal that's getting deleted
                } else if (control.value._deleted) {
                  await this.removeGoal(control.value, batchConfig);
                // if it's a goal that's getting updated
                } else if (control.value.originalText !== control.value.text || control.value.originalOrder !== i + 1 || (!control.value.originalQuarterlyGoalId && control.value.__quarterlyGoalId)) {
                  await this.updateGoal(control.value, i, batchConfig);
                }
              }));
            }, {
              optimistic: true,
              // this doesn't do anything since we are doing optimistic updates,
              // but leaving it here in case we want to do pessimistic in the future
              loading: this.loading,
              snackBarConfig: {
                successMessage: 'Goals successfully updated',
                failureMessage: 'Goals failed to update',
                undoOnAction: true,
                config: { duration: 5000 },
              },
            });
            this.dialogRef.close();
          } catch (error) {
            console.error(error.message);
          }
        },
      },
      panelClass: ['dialog-side-panel', 'no-dialog-anim'],
    });
  }

  /** Update weekly goal. */
  async checkGoal(goal: WeeklyGoal) {
    await this.weeklyGoalStore.update(goal.__id, {
      completed: !goal.completed,
      ...(!goal.completed ? { endDate: Timestamp.now() } : {}),
    }, {
      optimistic: true,
      snackBarConfig: {
        successMessage: goal.completed ? 'Marked goal as incomplete' : 'Marked goal as complete',
        failureMessage: 'Failed to update goal',
        config: {
          verticalPosition: 'bottom',
          horizontalPosition: 'center',
        },
      },
    });
  }

  /**
   * Queries the matching quarterly goal for a given clicked weekly goal to trigger the notes page opening.
   *
   * @param goal - The weekly goal clicked, which will tell us which quarterly goal we should open the notes page for.
   */
  handleGoalClicked(goal: WeeklyGoalData) {
    const associatedQuarterlyGoal = this.quarterlyGoalStore.selectEntity(goal.__quarterlyGoalId);
    this.goalClicked.emit(associatedQuarterlyGoal);
  }

  // --------------- OTHER -------------------------------

  /** Helper function for adding a new goal to the batch write */
  async addNewGoal(controlValue, i, batchConfig) {
    // Add a quarterly goal
    await this.weeklyGoalStore.add(Object.assign({}, {
      __userId: this.currentUser().__id,
      __quarterlyGoalId: controlValue.__quarterlyGoalId,
      text: controlValue.text,
      completed: false,
      order: i + 1,
      _deleted: controlValue._deleted,
    }), { batchConfig });
  }

  /** Helper function for removing a goal in the batch write */
  async removeGoal(controlValue, batchConfig) {
    // no restrictions on deleting weekly goals, unlike quarterly goals
    await this.weeklyGoalStore.remove(controlValue.__weeklyGoalId, { batchConfig });
  }

  /** Helper function for updating a goal in the batch write */
  async updateGoal(controlValue, i, batchConfig) {
    // text or quarterly goal has changed, general update
    await this.weeklyGoalStore.update(controlValue.__weeklyGoalId, Object.assign({}, {
      __quarterlyGoalId: controlValue.__quarterlyGoalId,
      text: controlValue.text,
      order: i + 1,
      _deleted: controlValue._deleted,
    }), { batchConfig });
  }

  // --------------- LOAD AND CLEANUP --------------------

  ngOnInit(): void {
    // loading uncompleted goals
    this.weeklyGoalStore.load([['__userId', '==', this.currentUser()?.__id], ['completed', '==', false]], {}, (weeklyGoal) => [
      LoadQuarterlyGoal.create(this.quarterlyGoalStore, [['__id', '==', weeklyGoal.__quarterlyGoalId]], {}),
      LoadHashtag.create(this.hashtagStore, [['__id', '==', weeklyGoal.__hashtagId]], {}),
    ], { loading: this.loading });

    // loading completed goals
    this.weeklyGoalStore.load([['__userId', '==', this.currentUser()?.__id], ['endDate', '>=', Timestamp.fromDate(getStartWeekDate())]], { orderBy: 'order' }, (weeklyGoal) => [
      LoadQuarterlyGoal.create(this.quarterlyGoalStore, [['__id', '==', weeklyGoal.__quarterlyGoalId]], {}),
      LoadHashtag.create(this.hashtagStore, [['__id', '==', weeklyGoal.__hashtagId]], {}),
    ]);
  }

  ngAfterViewInit(): void {
    /** Disable animation on initial view / page load : Angular
    * https://stackoverflow.com/questions/49012602/angular-disable-animation-on-initial-view-page-load
    */
    setTimeout(() => {
      this.animationDisabled = false;
    }, 3000);
  }
}
